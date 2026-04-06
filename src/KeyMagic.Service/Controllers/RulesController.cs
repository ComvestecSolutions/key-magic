using KeyMagic.Core.Configuration;
using KeyMagic.Core.Models;
using KeyMagic.Core.Services;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace KeyMagic.Service.Controllers;

/// <summary>
/// REST API for managing blocking rules.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class RulesController : ControllerBase
{
    private readonly ConfigStore _configStore;

    public RulesController(ConfigStore configStore)
    {
        _configStore = configStore;
    }

    /// <summary>GET /api/rules : list all rules</summary>
    [HttpGet]
    public ActionResult<List<BlockingRule>> GetAll()
    {
        // Return a snapshot to avoid concurrent modification during serialization
        var (_, rules, _) = _configStore.GetBlockingSnapshot();
        return Ok(rules);
    }

    /// <summary>GET /api/rules/{id} : get a specific rule</summary>
    [HttpGet("{id}")]
    public ActionResult<BlockingRule> GetById(string id)
    {
        var (_, rules, _) = _configStore.GetBlockingSnapshot();
        var rule = rules.Find(r => r.Id == id);
        if (rule == null) return NotFound();
        return Ok(rule);
    }

    /// <summary>POST /api/rules : create a new rule</summary>
    [HttpPost]
    public ActionResult<BlockingRule> Create([FromBody] CreateRuleRequest request)
    {
        var shortcut = new ShortcutKey
        {
            DisplayName = request.DisplayName,
            VirtualKeyCode = request.VirtualKeyCode,
            Ctrl = request.Ctrl,
            Alt = request.Alt,
            Shift = request.Shift,
            Win = request.Win
        };

        var rule = _configStore.AddRule(shortcut, request.TargetProcesses, request.Description);
        return CreatedAtAction(nameof(GetById), new { id = rule.Id }, rule);
    }

    /// <summary>PUT /api/rules/{id} : update an existing rule</summary>
    [HttpPut("{id}")]
    public ActionResult<BlockingRule> Update(string id, [FromBody] UpdateRuleRequest request)
    {
        BlockingRule? updated = null;
        _configStore.Update(config =>
        {
            var rule = config.Rules.Find(r => r.Id == id);
            if (rule != null)
            {
                if (request.DisplayName != null) rule.Shortcut.DisplayName = request.DisplayName;
                if (request.VirtualKeyCode.HasValue) rule.Shortcut.VirtualKeyCode = request.VirtualKeyCode.Value;
                if (request.Ctrl.HasValue) rule.Shortcut.Ctrl = request.Ctrl.Value;
                if (request.Alt.HasValue) rule.Shortcut.Alt = request.Alt.Value;
                if (request.Shift.HasValue) rule.Shortcut.Shift = request.Shift.Value;
                if (request.Win.HasValue) rule.Shortcut.Win = request.Win.Value;
                if (request.TargetProcesses != null) rule.TargetProcesses = request.TargetProcesses;
                if (request.Description != null) rule.Description = request.Description;
                if (request.Enabled.HasValue) rule.Enabled = request.Enabled.Value;
                updated = rule;
            }
        });

        if (updated == null) return NotFound();
        return Ok(updated);
    }

    /// <summary>DELETE /api/rules/{id} : delete a rule</summary>
    [HttpDelete("{id}")]
    public ActionResult Delete(string id)
    {
        var removed = _configStore.RemoveRule(id);
        if (!removed) return NotFound();
        return NoContent();
    }

    /// <summary>POST /api/rules/{id}/toggle : toggle a rule on/off</summary>
    [HttpPost("{id}/toggle")]
    public ActionResult<object> Toggle(string id)
    {
        var (_, rules, _) = _configStore.GetBlockingSnapshot();
        var rule = rules.Find(r => r.Id == id);
        if (rule == null) return NotFound();

        var newState = _configStore.ToggleRule(id);
        return Ok(new { id, enabled = newState });
    }

    /// <summary>POST /api/rules/batch : create multiple rules at once</summary>
    [HttpPost("batch")]
    public ActionResult<List<BlockingRule>> CreateBatch([FromBody] BatchCreateRequest request)
    {
        var created = new List<BlockingRule>();
        _configStore.Update(config =>
        {
            foreach (var shortcut in request.Shortcuts)
            {
                var sk = new ShortcutKey
                {
                    DisplayName = shortcut.DisplayName,
                    VirtualKeyCode = shortcut.VirtualKeyCode,
                    Ctrl = shortcut.Ctrl,
                    Alt = shortcut.Alt,
                    Shift = shortcut.Shift,
                    Win = shortcut.Win
                };

                var rule = new BlockingRule
                {
                    Shortcut = sk,
                    TargetProcesses = request.TargetProcesses ?? new List<string>(),
                    Description = shortcut.Description ?? shortcut.DisplayName,
                    Enabled = request.Enabled
                };

                config.Rules.Add(rule);
                created.Add(rule);
            }
        });

        return Ok(created);
    }

    /// <summary>DELETE /api/rules/batch : delete multiple rules at once</summary>
    [HttpDelete("batch")]
    public ActionResult DeleteBatch([FromBody] BatchDeleteRequest request)
    {
        int removed = 0;
        _configStore.Update(config =>
        {
            removed = config.Rules.RemoveAll(r => request.Ids.Contains(r.Id));
        });
        return Ok(new { removed });
    }

    /// <summary>POST /api/rules/batch-toggle : toggle multiple rules at once</summary>
    [HttpPost("batch-toggle")]
    public ActionResult BatchToggle([FromBody] BatchToggleRequest request)
    {
        _configStore.Update(config =>
        {
            foreach (var rule in config.Rules)
            {
                if (request.Ids.Contains(rule.Id))
                    rule.Enabled = request.Enabled;
            }
        });
        return Ok(new { updated = request.Ids.Count, enabled = request.Enabled });
    }

    /// <summary>PUT /api/rules/batch : update multiple rules (shared fields)</summary>
    [HttpPut("batch")]
    public ActionResult BatchUpdate([FromBody] BatchUpdateRequest request)
    {
        int updated = 0;
        _configStore.Update(config =>
        {
            foreach (var rule in config.Rules)
            {
                if (!request.Ids.Contains(rule.Id)) continue;
                if (request.DisplayName != null) rule.Shortcut.DisplayName = request.DisplayName;
                if (request.VirtualKeyCode.HasValue) rule.Shortcut.VirtualKeyCode = request.VirtualKeyCode.Value;
                if (request.Ctrl.HasValue) rule.Shortcut.Ctrl = request.Ctrl.Value;
                if (request.Alt.HasValue) rule.Shortcut.Alt = request.Alt.Value;
                if (request.Shift.HasValue) rule.Shortcut.Shift = request.Shift.Value;
                if (request.Win.HasValue) rule.Shortcut.Win = request.Win.Value;
                if (request.TargetProcesses != null) rule.TargetProcesses = request.TargetProcesses;
                if (request.Enabled.HasValue) rule.Enabled = request.Enabled.Value;
                if (request.Description != null) rule.Description = request.Description;
                updated++;
            }
        });
        return Ok(new { updated });
    }
}

// ─── Request DTOs ──────────────────────────────────────────────────

public class CreateRuleRequest
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string DisplayName { get; set; } = string.Empty;

    [Range(1, 255)]
    public int VirtualKeyCode { get; set; }
    public bool Ctrl { get; set; }
    public bool Alt { get; set; }
    public bool Shift { get; set; }
    public bool Win { get; set; }
    public List<string>? TargetProcesses { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}

public class UpdateRuleRequest
{
    [StringLength(200, MinimumLength = 1)]
    public string? DisplayName { get; set; }

    [Range(1, 255)]
    public int? VirtualKeyCode { get; set; }
    public bool? Ctrl { get; set; }
    public bool? Alt { get; set; }
    public bool? Shift { get; set; }
    public bool? Win { get; set; }
    public List<string>? TargetProcesses { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
    public bool? Enabled { get; set; }
}

public class BatchShortcutItem
{
    [Required]
    [StringLength(200, MinimumLength = 1)]
    public string DisplayName { get; set; } = string.Empty;

    [Range(1, 255)]
    public int VirtualKeyCode { get; set; }
    public bool Ctrl { get; set; }
    public bool Alt { get; set; }
    public bool Shift { get; set; }
    public bool Win { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}

public class BatchCreateRequest
{
    [Required]
    [MinLength(1)]
    public List<BatchShortcutItem> Shortcuts { get; set; } = new();
    public List<string>? TargetProcesses { get; set; }
    public bool Enabled { get; set; } = true;
}

public class BatchDeleteRequest
{
    [Required]
    [MinLength(1)]
    public List<string> Ids { get; set; } = new();
}

public class BatchToggleRequest
{
    [Required]
    [MinLength(1)]
    public List<string> Ids { get; set; } = new();
    public bool Enabled { get; set; }
}

public class BatchUpdateRequest
{
    [Required]
    [MinLength(1)]
    public List<string> Ids { get; set; } = new();

    [StringLength(200, MinimumLength = 1)]
    public string? DisplayName { get; set; }

    [Range(1, 255)]
    public int? VirtualKeyCode { get; set; }
    public bool? Ctrl { get; set; }
    public bool? Alt { get; set; }
    public bool? Shift { get; set; }
    public bool? Win { get; set; }

    public List<string>? TargetProcesses { get; set; }
    public bool? Enabled { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }
}
