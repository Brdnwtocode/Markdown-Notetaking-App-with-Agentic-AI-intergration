export default function WorkspacePage() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-12">
        <h1 className="text-3xl font-medium text-zinc-500 tracking-tight">No file is open</h1>
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <button className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium tracking-wide">Create new file</button>
          <button className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium tracking-wide">Go to file</button>
          <button className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium tracking-wide">See recent files</button>
        </div>
      </div>
    </div>
  );
}
