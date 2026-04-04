namespace KeyMagic.Service.Hosting;

internal static class FrontendAssetLocator
{
    public sealed record FrontendAssetRoot(string RootPath, string Source);

    public static FrontendAssetRoot? Resolve()
    {
        foreach (var candidate in EnumerateCandidates())
        {
            if (Directory.Exists(candidate.RootPath) && File.Exists(Path.Combine(candidate.RootPath, "index.html")))
            {
                return candidate;
            }
        }

        return null;
    }

    private static IEnumerable<FrontendAssetRoot> EnumerateCandidates()
    {
        yield return new FrontendAssetRoot(Path.Combine(AppContext.BaseDirectory, "wwwroot"), "published-spa");

        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        const int maxDepth = 8;
        for (var depth = 0; directory != null && depth < maxDepth; depth++)
        {
            yield return new FrontendAssetRoot(Path.Combine(directory.FullName, "src", "KeyMagic.Service", "wwwroot"), "source-wwwroot");
            yield return new FrontendAssetRoot(Path.Combine(directory.FullName, "src", "KeyMagic.Web", "dist"), "spa-dist");
            directory = directory.Parent;
        }
    }
}