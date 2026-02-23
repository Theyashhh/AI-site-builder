import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define files and folders to exclude
const EXCLUDED_ITEMS = [
  'node_modules',
  '.git',
  '.env',
  'dist',
  'build',
  '.next',
  'coverage',
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.vscode',
  '.idea',
  'generated' // Prisma generated folder
];

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

// Helper function to check if item should be excluded
const shouldExclude = (itemName: string): boolean => {
  return EXCLUDED_ITEMS.some(excluded => itemName.includes(excluded));
};

// Helper function to get file extension
const getFileExtension = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  return ext.replace('.', '');
};

// Recursively read directory structure
const readDirectoryStructure = (dirPath: string, relativePath: string = ''): FileNode[] => {
  const items: FileNode[] = [];

  try {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      // Skip excluded items
      if (shouldExclude(file)) continue;

      const fullPath = path.join(dirPath, file);
      const relPath = path.join(relativePath, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        const children = readDirectoryStructure(fullPath, relPath);
        items.push({
          name: file,
          path: relPath,
          type: 'folder',
          children
        });
      } else if (stats.isFile()) {
        items.push({
          name: file,
          path: relPath,
          type: 'file',
          size: stats.size,
          extension: getFileExtension(file)
        });
      }
    }
  } catch (error) {
    console.error('Error reading directory:', error);
  }

  return items;
};

// Controller to get project file structure
export const getProjectStructure = async (req: Request, res: Response) => {
  try {
    // Get the root directory (go up from controllers to project root)
    const projectRoot = path.resolve(__dirname, '../../');
    
    const structure = readDirectoryStructure(projectRoot);

    res.json({
      success: true,
      structure,
      projectName: 'Site Builder'
    });
  } catch (error: any) {
    console.error('GET PROJECT STRUCTURE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read project structure'
    });
  }
};

// Controller to get a single file content
export const getFileContent = async (req: Request, res: Response) => {
  try {
    const { filepath } = req.body;

    if (!filepath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Security: Prevent directory traversal attacks
    const projectRoot = path.resolve(__dirname, '../../');
    const fullPath = path.resolve(projectRoot, filepath);

    // Make sure the requested file is within project root
    if (!fullPath.startsWith(projectRoot)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Read file content
    const content = fs.readFileSync(fullPath, 'utf-8');

    res.json({
      success: true,
      content,
      filepath
    });
  } catch (error: any) {
    console.error('GET FILE CONTENT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to read file content'
    });
  }
};

// Controller to download project as ZIP
export const downloadProjectZip = async (req: Request, res: Response) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../');
    
    // Set response headers for ZIP download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=site-builder-project.zip');

    // Create archiver instance
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Pipe archive to response
    archive.pipe(res);

    // Helper function to add files recursively
    const addDirectoryToArchive = (dirPath: string, archivePath: string = '') => {
      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        // Skip excluded items
        if (shouldExclude(file)) continue;

        const fullPath = path.join(dirPath, file);
        const zipPath = path.join(archivePath, file);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          addDirectoryToArchive(fullPath, zipPath);
        } else if (stats.isFile()) {
          archive.file(fullPath, { name: zipPath });
        }
      }
    };

    // Add all files to archive
    addDirectoryToArchive(projectRoot);

    // Finalize archive
    await archive.finalize();

    console.log('Project ZIP download completed');
  } catch (error: any) {
    console.error('DOWNLOAD PROJECT ZIP ERROR:', error);
    
    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to create project ZIP'
      });
    }
  }
};