using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Core.Services;

/// <summary>
/// Provides information about running processes for selection in the UI.
/// </summary>
public static class ProcessHelper
{
    /// <summary>
    /// Lists distinct process names currently running, excluding system processes.
    /// Returns sorted, deduplicated names.
    /// </summary>
    public static List<ProcessInfo> GetRunningProcesses(ILogger? logger = null)
    {
        var skipList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "svchost", "csrss", "smss", "lsass", "services", "wininit",
            "System", "Registry", "Idle", "dwm", "fontdrvhost",
            "WmiPrvSE", "dllhost", "conhost", "sihost", "taskhostw"
        };

        try
        {
            var processes = Process.GetProcesses();
            try
            {
                return processes
                    .Where(p => !string.IsNullOrWhiteSpace(p.ProcessName) && !skipList.Contains(p.ProcessName))
                    .GroupBy(p => p.ProcessName, StringComparer.OrdinalIgnoreCase)
                    .Select(g =>
                    {
                        string title = string.Empty;
                        try
                        {
                            title = g.FirstOrDefault(p => !string.IsNullOrWhiteSpace(p.MainWindowTitle))?.MainWindowTitle ?? string.Empty;
                        }
                        catch (Exception ex)
                        {
                            logger?.LogDebug(ex, "Could not get window title for process {Name}", g.Key);
                        }

                        return new ProcessInfo
                        {
                            ProcessName = g.Key,
                            WindowTitle = title,
                            InstanceCount = g.Count()
                        };
                    })
                    .OrderBy(p => p.ProcessName, StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            finally
            {
                foreach (var p in processes)
                    p.Dispose();
            }
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Failed to enumerate running processes");
            return new List<ProcessInfo>();
        }
    }
}

public class ProcessInfo
{
    public string ProcessName { get; set; } = string.Empty;
    public string WindowTitle { get; set; } = string.Empty;
    public int InstanceCount { get; set; }
}
