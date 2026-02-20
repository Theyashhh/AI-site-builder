import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import openai from '../config/openai.js';

// Controller Function to Make Revision
export const makeRevision = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const { message } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.credits < 5) {
      return res.status(403).json({ message: 'add more credits to make changes' });
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Please enter a valid prompt' });
    }

    const currentProject = await prisma.websiteProject.findFirst({
      where: { id: projectId, userId },
      include: { versions: true }
    });

    if (!currentProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await prisma.conversation.create({
      data: {
        role: 'user',
        content: message,
        projectId
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 5 } }
    });

    // Enhance user prompt
    const promptEnhanceResponse = await openai.chat.completions.create({
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [{
        role: 'system',
        content: `You are a prompt enhancement specialist. The user wants to make changes to their website. Enhance their request to be more specific and actionable for a web developer.

    Enhance this by:
    1. Being specific about what elements to change
    2. Mentioning design details (colors, spacing, sizes)
    3. Clarifying the desired outcome
    4. Using clear technical terms

    Return ONLY the enhanced request, nothing else. Keep it concise (1-2 sentences).`
      }, {
        role: 'user',
        content: `User's request: "${message}"`
      }]
    });

    const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
        projectId
      }
    });

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: 'Now making changes to your website...',
        projectId
      }
    });

    // Generate website code
    const codeGenerationResponse = await openai.chat.completions.create({
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [{
        role: 'system',
        content: `You are an expert web developer. 

    CRITICAL REQUIREMENTS:
    - Return ONLY the complete updated HTML code with the requested changes.
    - Use Tailwind CSS for ALL styling (NO custom CSS).
    - Use Tailwind utility classes for all styling changes.
    - Include all JavaScript in <script> tags before closing </body>
    - Make sure it's a complete, standalone HTML document with Tailwind CSS
    - Return the HTML Code Only, nothing else

    Apply the requested changes while maintaining the Tailwind CSS styling approach.`
      }, {
        role: 'user',
        content: `Here is the current website code: "${currentProject.current_code}" The user wants this change: "${enhancedPrompt}"`
      }]
    });

    const code = codeGenerationResponse.choices[0].message.content || '';

    if (!code) {
      await prisma.conversation.create({
        data: {
          role: 'assistant',
          content: "Unable to generate the code, please try again",
          projectId
        }
      });
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 5 } }
      });
      return res.status(500).json({ message: 'Failed to generate code' });
    }

    const version = await prisma.version.create({
      data: {
        code: code.replace(/```[a-z]*\n?/gi, '').replace(/```$/g, '').trim(),
        description: 'changes made',
        projectId
      }
    });

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: "I've made the changes to your website! You can now preview it",
        projectId
      }
    });

    await prisma.websiteProject.update({
      where: { id: projectId },
      data: {
        current_code: code.replace(/```[a-z]*\n?/gi, '').replace(/```$/g, '').trim(),
        current_version_index: version.id
      }
    });

    res.json({ message: 'Changes made successfully' });
  } catch (error: any) {
    const userId = req.userId;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 5 } }
      });
    }
    console.error('MAKE REVISION ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to make revision' });
  }
};

// Controller Function to rollback to a specific version
export const rollbackToVersion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { versionId } = req.params;
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    if (!versionId) {
      return res.status(400).json({ message: 'Version ID is required' });
    }

    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, userId },
      include: { versions: true }
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const version = project.versions.find((v) => v.id === versionId);

    if (!version) {
      return res.status(404).json({ message: 'Version not found' });
    }

    await prisma.websiteProject.update({
      where: { id: projectId },
      data: {
        current_code: version.code,
        current_version_index: version.id
      }
    });

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: "I've rolled back your website to selected version. You can now preview it",
        projectId
      }
    });

    res.json({ message: 'Version rolled back' });
  } catch (error: any) {
    console.error('ROLLBACK ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to rollback' });
  }
};

// Controller function to delete a project
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID required' });
    }

    // Verify ownership
    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Delete project (cascade will handle versions and conversations)
    await prisma.websiteProject.delete({
      where: { id: projectId }
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('DELETE PROJECT ERROR:', error);
    res.status(500).json({ message: 'Failed to delete project' });
  }
};

// Controller for getting project code for preview
export const getProjectPreview = async (req: Request, res: Response) => {
  try {
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, userId },
      include: { versions: true }
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ project });
  } catch (error: any) {
    console.error('GET PREVIEW ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to get preview' });
  }
};

// Get published projects
export const getPublishedProjects = async (req: Request, res: Response) => {
  try {
    const projects = await prisma.websiteProject.findMany({
      where: { isPublished: true },
      include: { user: true }
    });

    res.json({ projects });
  } catch (error: any) {
    console.error('GET PUBLISHED PROJECTS ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to get projects' });
  }
};

// Get a single project by id
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId }
    });

    if (!project || project.isPublished === false || !project?.current_code) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ code: project.current_code });
  } catch (error: any) {
    console.error('GET PROJECT BY ID ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to get project' });
  }
};

// Controller to Save Project Code
export const saveProjectCode = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }

    const project = await prisma.websiteProject.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await prisma.websiteProject.update({
      where: { id: projectId },
      data: { current_code: code, current_version_index: '' }
    });

    res.json({ message: 'Project saved successfully' });
  } catch (error: any) {
    console.error('SAVE PROJECT ERROR:', error);
    res.status(500).json({ message: error.message || 'Failed to save project' });
  }
};