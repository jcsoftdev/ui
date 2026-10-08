export interface ChatProps {
  /** Who is speaking. */
  role: "user" | "assistant";
}

export function Chat({ role }: ChatProps) {
  return <p>{role}</p>;
}
