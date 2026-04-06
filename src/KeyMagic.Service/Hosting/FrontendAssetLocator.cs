namespace KeyMagic.Service.Hosting;

using Microsoft.Extensions.FileProviders;

internal static class FrontendAssetLocator
{
    public sealed record FrontendAssetRoot(IFileProvider FileProvider, string Source, string? PhysicalRootPath = null);

    public static FrontendAssetRoot? Resolve()
    {
        foreach (var candidate in EnumerateCandidates())
        {
            if (candidate.FileProvider.GetFileInfo("index.html").Exists)
            {
                return candidate;
            }
        }

        var embeddedAssetRoot = TryResolveEmbeddedAssetRoot();
        if (embeddedAssetRoot?.FileProvider.GetFileInfo("index.html").Exists == true)
        {
            return embeddedAssetRoot;
        }

        return null;
    }

    private static FrontendAssetRoot? TryResolveEmbeddedAssetRoot()
    {
        try
        {
            return new FrontendAssetRoot(
                new ManifestEmbeddedFileProvider(typeof(FrontendAssetLocator).Assembly, "wwwroot"),
                "embedded-wwwroot");
        }
        catch (Exception ex)
        {
            StartupDiagnostics.RecordException("Failed to initialize embedded dashboard asset provider", ex);
            return null;
        }
    }

    private static IEnumerable<FrontendAssetRoot> EnumerateCandidates()
    {
        var publishedRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (Directory.Exists(publishedRootPath))
        {
            yield return new FrontendAssetRoot(new PhysicalFileProvider(publishedRootPath), "published-spa", publishedRootPath);
        }

        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        const int maxDepth = 8;
        for (var depth = 0; directory != null && depth < maxDepth; depth++)
        {
            var serviceRootPath = Path.Combine(directory.FullName, "src", "KeyMagic.Service", "wwwroot");
            if (Directory.Exists(serviceRootPath))
            {
                yield return new FrontendAssetRoot(new PhysicalFileProvider(serviceRootPath), "source-wwwroot", serviceRootPath);
            }

            var spaDistPath = Path.Combine(directory.FullName, "src", "KeyMagic.Web", "dist");
            if (Directory.Exists(spaDistPath))
            {
                yield return new FrontendAssetRoot(new PhysicalFileProvider(spaDistPath), "spa-dist", spaDistPath);
            }

            directory = directory.Parent;
        }
    }
}