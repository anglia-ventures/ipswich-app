---
name: draft-article
description: Push a finished article (headline + excerpt + body) into Ghost CMS as a draft post, using the ghost-cms MCP connector's create_post tool. Make sure to use this skill whenever the user asks to draft, post, push, send, or upload an article to Ghost, or says things like "put this in Ghost," "create a Ghost draft from this," or "send this article over" — even if they don't name the skill explicitly. This skill only transfers content that's already written; it never invents a headline, excerpt, or body, and it always leaves the post as an untagged, unauthored draft so editorial review happens in Ghost Admin afterward.
---

## What this skill does — and doesn't do

Takes an article that's **already written** — at minimum a headline and a body, usually with an
excerpt too — and creates it as a **draft** post in Ghost via the `ghost-cms` MCP connector's
`create_post` tool.

It does not write headlines, compose excerpts, draft body copy, pick tags, or assign an author.
Those are editorial calls made by whoever wrote the piece, or decided later in Ghost Admin. If the
headline or body is missing or unclear, ask the user for it rather than inventing something to fill
the gap — that risks publishing content nobody actually signed off on.

## Step 1: Find the content

The article might already be in the conversation (pasted, or written earlier in this session), or
it might live in a file in the current project — look for something like `draft.md`, `article.md`,
`post.md`, or the most recently modified `.md`/`.txt` file if the project is dedicated to one piece.

You're looking for up to three things:
1. **Headline** — required. Becomes the post's `title`. Ask if you can't find one.
2. **Body** — required. Becomes the post's `html`. Ask if you can't find one.
3. **Excerpt** — optional. A short summary, becomes the post's `excerpt`. If there isn't one, don't
   invent it and don't ask — just create the draft without it (see Step 3).

## Step 2: Convert the body to HTML

`create_post` takes the body as HTML, not Markdown. If the body is written in Markdown, convert it
to clean, semantic HTML (`<p>`, `<h2>`/`<h3>`, `<strong>`, `<em>`, `<a href>`, `<ul>`/`<ol>`/`<li>`,
`<blockquote>`) before calling the tool. Don't wrap it in `<html>`/`<body>` tags — just the content
markup itself.

## Step 3: Create the draft

Call the `ghost-cms` connector's `create_post` tool with:
- `title` — the headline, verbatim
- `excerpt` — the excerpt, verbatim, if one exists. Omit the field entirely if it doesn't; don't
  block on it and don't make one up.
- `html` — the converted body

Leave everything else unset:
- **No `status`** — it defaults to `draft`. Never pass `status: "published"` or `"scheduled"` here;
  going live is a separate, deliberate editorial decision that belongs to a human in Ghost Admin.
- **No `tags`** — leave the post untagged. Tags get added manually during review.
- **No `authors`** — leave the byline unset. It gets assigned manually during review.
- **No `feature_image`** — unless the user explicitly hands you one to use.

## Step 4: Report back

Tell the user the draft was created and surface the `edit_url` from the tool's response, so they can
jump straight into Ghost Admin to add tags, assign an author, attach a feature image, and give it a
final read before publishing. If there was no excerpt to set, mention that too, so they know to add
one during review rather than assuming it was handled.

## If the connector isn't available

If there's no `create_post` tool from a `ghost-cms` MCP connector available, say so plainly instead
of working around it (e.g. don't call Ghost's API directly with a raw fetch). The user needs to add
the connector first — point them at the `mcp-ghost-server` project's README for setup.

## Example

**Input:** the user has a finished piece open in the project — `draft.md` contains a headline as an
H1, a one-line summary underneath, and the rest of the article in Markdown — and says "push this to
Ghost as a draft."

**What you do:** read `draft.md`, take the H1 as the headline and the summary line as the excerpt,
convert the remaining Markdown to HTML, then call `create_post` with just `title`/`excerpt`/`html`
— no tags, no author, no status override. Reply with confirmation and the edit link, e.g.:

> Created as a draft: **"Marina redevelopment gets planning go-ahead"**
> Review and finish it here: https://ipswich-co-uk.ghost.io/ghost/#/editor/post/68f2a1...
