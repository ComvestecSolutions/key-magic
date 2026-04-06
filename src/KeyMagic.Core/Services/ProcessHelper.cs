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
                var snapshots = new List<(string ProcessName, string WindowTitle)>();

                foreach (var process in processes)
                {
                    string processName;
                    try
                    {
                        processName = process.ProcessName;
                    }
                    catch (Exception ex)
                    {
                        logger?.LogDebug(ex, "Could not read process name for PID {ProcessId}", process.Id);
                        continue;
                    }

                    if (string.IsNullOrWhiteSpace(processName) || skipList.Contains(processName))
                    {
                        continue;
                    }

                    string windowTitle = string.Empty;
                    try
                    {
                        windowTitle = process.MainWindowTitle;
                    }
                    catch (Exception ex)
                    {
                        logger?.LogDebug(ex, "Could not read window title for process {Name}", processName);
                    }

                    snapshots.Add((processName, windowTitle));
                }

                return snapshots
                    .GroupBy(process => process.ProcessName, StringComparer.OrdinalIgnoreCase)
                    .Select(g =>
                    {
                        var title = g.FirstOrDefault(process => !string.IsNullOrWhiteSpace(process.WindowTitle)).WindowTitle ?? string.Empty;

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
