using KeyMagic.Core.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KeyMagic.Service.Controllers;

/// <summary>
/// REST API for listing running processes (for target application selection).
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ProcessesController : ControllerBase
{
    private readonly ILogger<ProcessesController> _logger;

    public ProcessesController(ILogger<ProcessesController> logger)
    {
        _logger = logger;
    }

    /// <summary>GET /api/processes : list running processes</summary>
    [HttpGet]
    public ActionResult<List<ProcessInfo>> GetRunning()
    {
        var processes = ProcessHelper.GetRunningProcesses(_logger);
        return Ok(processes);
    }
}
