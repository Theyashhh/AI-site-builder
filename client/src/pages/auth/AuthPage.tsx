import { useParams } from "react-router-dom"
import { AuthView } from "@daveyplate/better-auth-ui"

export default function AuthPage() {
  const { pathname } = useParams()

  return (
    <main className="flex flex-col p-6 justify-center items-center h-[80vh]">
      <AuthView pathname={pathname} classNames={{base: 'bg-black/10 ring ring-indigo-900'}} />
    </main>
  )
}