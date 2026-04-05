import type { WidgetSize } from "@/types/modules";

const sizeClasses: Record<WidgetSize, string> = {
  small: "col-span-1",
  medium: "col-span-1 lg:col-span-2",
  large: "col-span-1 lg:col-span-3",
};

interface WidgetCardProps {
  title: string;
  description?: string;
  size: WidgetSize;
  children: React.ReactNode;
}

export default function WidgetCard({ title, description, size, children }: WidgetCardProps) {
  return (
    <div className={`${sizeClasses[size]} bg-slate-800 border border-slate-700 rounded-xl flex flex-col`}>
      <div className="px-5 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex-1 p-5">
        {children}
      </div>
    </div>
  );
}
