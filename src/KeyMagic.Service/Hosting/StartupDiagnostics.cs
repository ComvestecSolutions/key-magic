namespace KeyMagic.Service.Hosting;

using System.Reflection;

internal static class StartupDiagnostics
{
    private const string AppFolderName = "KeyMagic";
    private const string LogFolderName = "logs";
    private const string LogFileName = "startup.log";
    private static readonly object SyncRoot = new();
    private static string? _logFilePath;

    public static string LogFilePath
    {
        get
        {
            lock (SyncRoot)
            {
                _logFilePath ??= BuildLogFilePath();
                return _logFilePath;
            }
        }
    }

    public static void BeginSession(string[] args)
    {
        WriteRaw(Environment.NewLine + new string('=', 72) + Environment.NewLine);
        Record($"Startup session began. Version={GetProductVersion()}; ProcessPath={Environment.ProcessPath ?? "unknown"}");
        Record($"BaseDirectory={AppContext.BaseDirectory}");
        Record($"CommandLine={Environment.CommandLine}");
        if (args.Length > 0)
        {
            Record($"Arguments={string.Join(" ", args)}");
        }
    }

    public static void Record(string message)
    {
        WriteRaw($"[{DateTime.UtcNow:O}] {message}{Environment.NewLine}");
    }

    public static void RecordException(string context, Exception ex)
    {
        WriteRaw($"[{DateTime.UtcNow:O}] {context}{Environment.NewLine}{ex}{Environment.NewLine}");
    }

    public static string BuildStartupFailureMessage(Exception ex)
    {
        var detail = ex.InnerException?.Message is { Length: > 0 } innerMessage
            ? $"{ex.Message}{Environment.NewLine}{Environment.NewLine}Cause: {innerMessage}"
            : ex.Message;

        return $"KeyMagic failed to start.{Environment.NewLine}{Environment.NewLine}{detail}{Environment.NewLine}{Environment.NewLine}See the startup log for details:{Environment.NewLine}{LogFilePath}";
    }

    public static string BuildDashboardUnavailableMessage()
    {
        return $"KeyMagic started without the local dashboard.{Environment.NewLine}{Environment.NewLine}See the startup log for details:{Environment.NewLine}{LogFilePath}";
    }

    private static string BuildLogFilePath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, AppFolderName, LogFolderName, LogFileName);
    }

    private static void WriteRaw(string text)
    {
        try
        {
            var logFilePath = LogFilePath;
            var logDirectory = Path.GetDirectoryName(logFilePath);
            if (!string.IsNullOrWhiteSpace(logDirectory))
            {
                Directory.CreateDirectory(logDirectory);
            }

            File.AppendAllText(logFilePath, text);
        }
        catch
        {
        }
    }

    private static string GetProductVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        return assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? assembly.GetName().Version?.ToString()
            ?? "unknown";
    }
}