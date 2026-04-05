import moduleRegistry from "@/lib/moduleRegistry";
import WidgetCard from "./WidgetCard";

export default function WidgetGrid() {
  const widgetModules = moduleRegistry.filter((mod) => mod.widget);

  if (widgetModules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🧩</span>
        </div>
        <h3 className="text-slate-300 font-medium mb-1">No widgets yet</h3>
        <p className="text-slate-500 text-sm max-w-xs">
          Add modules to the registry in{" "}
          <code className="text-indigo-400 text-xs">lib/moduleRegistry.ts</code>{" "}
          to see their widgets here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {widgetModules.map((mod) => {
        const Widget = mod.widget!.component;
        return (
          <WidgetCard
            key={mod.id}
            title={mod.label}
            description={mod.description}
            size={mod.widget!.size}
          >
            <Widget />
          </WidgetCard>
        );
      })}
    </div>
  );
}
