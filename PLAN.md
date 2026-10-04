# Talking-Head Editing Workflow: Plan

Goal: drop in talking-head footage, Claude cuts it (silences, fillers, retakes), you review and leave notes, Claude plans and builds the creative edit, and you get an editable CapCut draft.

## Decisions so far

- Runs in Claude Code on the web / Claude app (chat), not the local terminal.
- Footage: vertical iPhone TikTok-style talking head, single camera.
- Editor: CapCut Desktop (Pro) on Mac.
- Style: no fixed style yet. Learn from reference videos (Instagram/TikTok clips uploaded to chat) and test styles until one sticks.
- No prebuilt style packs. Each style is saved as a profile you can reuse or tweak.

## Pipeline

```
footage -> 1 Transcribe -> 2 Rough cut -> 3 Review widget -> 4 Creative plan -> 5 CapCut draft -> 6 SFX / final pass
```

Every stage writes JSON into `projects/<name>/`, so any stage can be re-run or edited on its own.

| Stage | Output | Notes |
|---|---|---|
| 1 Transcribe | `transcript.json` | Local Whisper, word-level timestamps |
| 2 Rough cut | `cuts.json` | ffmpeg silence detection + filler/retake detection. Edit decision list, not a rendered video |
| 3 Review widget | `notes.json` | See below |
| 4 Creative plan | `creative_plan.json` | Zooms, graphics, captions, SFX, driven by transcript + notes + style profile. You approve before build |
| 5 CapCut draft | CapCut draft folder | Built from cuts + plan |
| 6 Final pass | updated draft | Add sound effects, tweak |

## Review widget (stage 3)

Single local HTML page, top to bottom:

1. Full video at the top, previewing all the cuts applied.
2. Transcript underneath, one line per row.
3. Under each line: a **Notes** box.
4. Under that: a **Reference links** box.
5. "Copy prompt" button bundles everything into a prompt to paste back into Claude.

## Styles

- `styles/<name>.json`: fonts, colours, caption look, zoom frequency, cut pace, SFX habits.
- "Learn from this video": upload a reference clip, Claude extracts frames, cut pace, caption style and audio cues, then writes or updates a style profile.
- Try the same footage in different styles side by side, keep what works.

## Build order

1. **CapCut spike:** generate a draft with one cut and one text layer, open it on your Mac.
2. Transcribe + rough cut.
3. Review widget.
4. Style profile + creative plan.
5. Full CapCut builder (zooms, captions, graphics), then SFX.
6. Reference-video learning.

Steps 1-3 already produce a useful tool.

## Open risks

- **CapCut draft format** is unofficial and changes between versions. Fallback: FCPXML timeline.
- **Footage on your Mac:** CapCut drafts point to media by file path on your Mac. The draft must reference where the footage will live on your machine.
- **Large iPhone files:** chat uploads may have size limits. May need to compress/proxy the video for review.
- **Getting files to your Mac:** this session is a cloud container. Output moves through git (push here, pull on your Mac) or download.
