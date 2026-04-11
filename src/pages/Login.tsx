import { LoginScreenBody } from "@/components/auth/LoginScreenBody";

const Login = () => (
  <div className="relative flex min-h-screen min-h-[100dvh] w-full max-w-[100vw] flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-background">
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute top-1/4 left-1/4 aspect-square w-96 max-w-[80vw] rounded-full gradient-brand opacity-5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 aspect-square w-80 max-w-[70vw] rounded-full gradient-brand opacity-5 blur-3xl" />
    </div>
    <LoginScreenBody variant="page" formId="login-form" />
  </div>
);

export default Login;
