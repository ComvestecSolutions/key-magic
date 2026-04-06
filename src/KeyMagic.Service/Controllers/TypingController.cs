using KeyMagic.Core.Configuration;
using KeyMagic.Core.Models;
using KeyMagic.Core.Services;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace KeyMagic.Service.Controllers;

/// <summary>
/// REST API for managing typing rules and triggering text injection.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class TypingController : ControllerBase
{
    private readonly ConfigStore _configStore;
    private readonly TypingService _typingService;

    public TypingController(ConfigStore configStore, TypingService typingService)
    {
        _configStore = configStore;
        _typingService = typingService;
    }

    /// <summary>GET /api/typing — list all typing rules</summary>
    [HttpGet]
    public ActionResult<List<TypingRule>> GetAll()
    {
        return Ok(_configStore.Config.TypingRules.ToList());
    }

    /// <summary>GET /api/typing/{id} — get a single rule</summary>
    [HttpGet("{id}")]
    public ActionResult<TypingRule> GetById(string id)
    {
        var rule = _configStore.Config.TypingRules.Find(r => r.Id == id);
        if (rule == null) return NotFound();
        return Ok(rule);
    }

    /// <summary>POST /api/typing — create a new typing rule</summary>
    [HttpPost]
    public ActionResult<TypingRule> Create([FromBody] CreateTypingRuleRequest request)
    {
        var hotkey = new ShortcutKey
        {
            DisplayName = request.DisplayName ?? string.Empty,
            VirtualKeyCode = request.VirtualKeyCode,
            Ctrl = request.Ctrl,
            Alt = request.Alt,
            Shift = request.Shift,
            Win = request.Win
        };

        var rule = _configStore.AddTypingRule(
            hotkey,
            request.Source,
            request.Text ?? string.Empty,
            request.Name ?? string.Empty,
            request.InterKeyDelayMs ?? 30,
            request.Enabled ?? true);

        return CreatedAtAction(nameof(GetById), new { id = rule.Id }, rule);
    }

    /// <summary>PUT /api/typing/{id} — update an existing rule</summary>
    [HttpPut("{id}")]
    public ActionResult<TypingRule> Update(string id, [FromBody] UpdateTypingRuleRequest request)
    {
        TypingRule? updated = null;
        _configStore.Update(config =>
        {
            var ruleIndex = config.TypingRules.FindIndex(r => r.Id == id);
            if (ruleIndex < 0) return;

            var patchedRule = PatchTypingRule(config.TypingRules[ruleIndex], request);
            config.TypingRules[ruleIndex] = patchedRule;
            updated = patchedRule;
        });

        if (updated == null) return NotFound();
        return Ok(updated);
    }

    /// <summary>DELETE /api/typing/{id} — delete a rule</summary>
    [HttpDelete("{id}")]
    public ActionResult Delete(string id)
    {
        var removed = _configStore.RemoveTypingRule(id);
        if (!removed) return NotFound();
        return NoContent();
    }

    /// <summary>POST /api/typing/{id}/toggle — toggle a rule on/off</summary>
    [HttpPost("{id}/toggle")]
    public ActionResult<object> Toggle(string id)
    {
        var rule = _configStore.Config.TypingRules.Find(r => r.Id == id);
        if (rule == null) return NotFound();

        var newState = _configStore.ToggleTypingRule(id);
        return Ok(new { id, enabled = newState });
    }

    /// <summary>
    /// POST /api/typing/{id}/fire — immediately type the rule's text into the
    /// focused window.
    ///
    /// <para>An optional <c>text</c> body field overrides the configured text,
    /// which is useful for ad-hoc injection without saving a rule first.  When
    /// the rule's source is <see cref="TextSource.Clipboard"/>, pass the text
    /// explicitly here because the clipboard cannot be read from the web-API
    /// background thread.</para>
    /// </summary>
    [HttpPost("{id}/fire")]
    public ActionResult Fire(string id, [FromBody] FireTypingRequest? request = null)
    {
        var rule = _configStore.Config.TypingRules.Find(r => r.Id == id);
        if (rule == null) return NotFound();
        if (!rule.Enabled) return BadRequest(new { error = "Rule is disabled." });

        // The caller may supply override text (e.g. pasted from clipboard in the UI).
        var text = request?.Text ?? rule.Text;
        if (string.IsNullOrEmpty(text))
            return BadRequest(new { error = "No text available to type." });

        // preDelayMs lets the caller (e.g. the web dashboard) give itself
        // enough time to switch focus to the target application before typing starts.
        int preDelay = request?.PreDelayMs ?? 0;
        _typingService.TriggerTyping(text, rule.InterKeyDelayMs, preDelay);
        return Ok(new { queued = true, length = text.Length, preDelayMs = preDelay });
    }

    private static TypingRule PatchTypingRule(TypingRule existingRule, UpdateTypingRuleRequest request)
    {
        var patchedRule = existingRule.Clone();

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            patchedRule.Name = request.Name;
        }

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            patchedRule.Hotkey.DisplayName = request.DisplayName;
        }

        if (request.VirtualKeyCode.HasValue)
        {
            patchedRule.Hotkey.VirtualKeyCode = request.VirtualKeyCode.Value;
        }

        if (request.Ctrl.HasValue)
        {
            patchedRule.Hotkey.Ctrl = request.Ctrl.Value;
        }

        if (request.Alt.HasValue)
        {
            patchedRule.Hotkey.Alt = request.Alt.Value;
        }

        if (request.Shift.HasValue)
        {
            patchedRule.Hotkey.Shift = request.Shift.Value;
        }

        if (request.Win.HasValue)
        {
            patchedRule.Hotkey.Win = request.Win.Value;
        }

        if (request.Source.HasValue)
        {
            patchedRule.Source = request.Source.Value;
        }

        if (request.Text != null)
        {
            patchedRule.Text = request.Text;
        }

        if (request.InterKeyDelayMs.HasValue)
        {
            patchedRule.InterKeyDelayMs = request.InterKeyDelayMs.Value;
        }

        if (request.Enabled.HasValue)
        {
            patchedRule.Enabled = request.Enabled.Value;
        }

        return patchedRule;
    }
}

// ─── Request DTOs ──────────────────────────────────────────────────────────────

public class CreateTypingRuleRequest
{
    public string? Name { get; set; }
    public string? DisplayName { get; set; }

    [Range(1, 255)]
    public int VirtualKeyCode { get; set; }

    public bool Ctrl { get; set; }
    public bool Alt { get; set; }
    public bool Shift { get; set; }
    public bool Win { get; set; }
    public TextSource Source { get; set; }

    [MaxLength(10000)]
    public string? Text { get; set; }

    [Range(0, 10000)]
    public int? InterKeyDelayMs { get; set; }

    public bool? Enabled { get; set; }
}

public class UpdateTypingRuleRequest
{
    public string? Name { get; set; }
    public string? DisplayName { get; set; }

    [Range(1, 255)]
    public int? VirtualKeyCode { get; set; }

    public bool? Ctrl { get; set; }
    public bool? Alt { get; set; }
    public bool? Shift { get; set; }
    public bool? Win { get; set; }
    public TextSource? Source { get; set; }

    [MaxLength(10000)]
    public string? Text { get; set; }

    [Range(0, 10000)]
    public int? InterKeyDelayMs { get; set; }

    public bool? Enabled { get; set; }
}

public class FireTypingRequest
{
    [MaxLength(10000)]
    public string? Text { get; set; }

    [Range(0, 60000)]
    public int? PreDelayMs { get; set; }
}
