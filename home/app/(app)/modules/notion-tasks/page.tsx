import TasksView from "@/components/modules/notion-tasks/TasksView";

export default function NotionTasksPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Tasks</h1>
        <p className="text-sm text-slate-400 mt-0.5">All tasks from Notion — filter by any column</p>
      </div>
      <TasksView />
    </div>
  );
}
