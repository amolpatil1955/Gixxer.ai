import Image from "next/image";

interface UserBadgeProps {
  name: string;
  email: string;
  image: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function UserBadge({ name, email, image }: UserBadgeProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight text-ink-50">{name}</p>
        <p className="text-xs leading-tight text-ink-400">{email}</p>
      </div>
      {image ? (
        <Image src={image} alt="" width={36} height={36} className="size-9 rounded-full border border-line-strong object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-ink-800 text-xs font-semibold tracking-wide text-ink-100"
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}
