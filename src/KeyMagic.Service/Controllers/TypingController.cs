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
            request.InterKeyDelayMs ?? 30);

        // Apply enabled state if explicitly provided (default = true).
        if (request.Enabled.HasValue && !request.Enabled.Value)
        {
            _configStore.Update(c =>
            {
                var r = c.TypingRules.Find(x => x.Id == rule.Id);
                if (r != null) r.Enabled = false;
            });
            rule.Enabled = false;
        }

        return CreatedAtAction(nameof(GetById), new { id = rule.Id }, rule);
    }

    /// <summary>PUT /api/typing/{id} — update an existing rule</summary>
    [HttpPut("{id}")]
    public ActionResult<TypingRule> Update(string id, [FromBody] UpdateTypingRuleRequest request)
    {
        TypingRule? updated = null;
        _configStore.Update(config =>
        {
            var rule = config.TypingRules.Find(r => r.Id == id);
            if (rule == null) return;

            if (request.Name != null) rule.Name = request.Name;
            if (request.DisplayName != null) rule.Hotkey.DisplayName = request.DisplayName;
            if (request.VirtualKeyCode.HasValue) rule.Hotkey.VirtualKeyCode = request.VirtualKeyCode.Value;
            if (request.Ctrl.HasValue) rule.Hotkey.Ctrl = request.Ctrl.Value;
            if (request.Alt.HasValue) rule.Hotkey.Alt = request.Alt.Value;
            if (request.Shift.HasValue) rule.Hotkey.Shift = request.Shift.Value;
            if (request.Win.HasValue) rule.Hotkey.Win = request.Win.Value;
            if (request.Source.HasValue) rule.Source = request.Source.Value;
            if (request.Text != null) rule.Text = request.Text;
            if (request.InterKeyDelayMs.HasValue) rule.InterKeyDelayMs = request.InterKeyDelayMs.Value;
            if (request.Enabled.HasValue) rule.Enabled = request.Enabled.Value;

            updated = rule;
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
}

// ─── Request DTOs ──────────────────────────────────────────────────────────────

public record CreateTypingRuleRequest(
    string? Name,
    string? DisplayName,
    [property: Range(1, 255)] int VirtualKeyCode,
    bool Ctrl,
    bool Alt,
    bool Shift,
    bool Win,
    TextSource Source,
    [property: MaxLength(10000)] string? Text,
    [property: Range(0, 10000)] int? InterKeyDelayMs,
    bool? Enabled);

public record UpdateTypingRuleRequest(
    string? Name,
    string? DisplayName,
    [property: Range(1, 255)] int? VirtualKeyCode,
    bool? Ctrl,
    bool? Alt,
    bool? Shift,
    bool? Win,
    TextSource? Source,
    [property: MaxLength(10000)] string? Text,
    [property: Range(0, 10000)] int? InterKeyDelayMs,
    bool? Enabled);

public record FireTypingRequest([property: MaxLength(10000)] string? Text, [property: Range(0, 60000)] int? PreDelayMs);
