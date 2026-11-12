import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { PostCard } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const base = { id: "p", author: { name: "Acme Club", handle: "acme", verified: true }, time: new Date(Date.now() - 5 * 60_000), text: "Hello", likes: 9, liked: false, comments: 3, shares: 0, media: [{ src: "a.svg", alt: "a" }, { src: "b.svg", alt: "b" }] };

test("PostCard: article, author, media, like toggles through onLike, counts are named buttons", () => {
  const post = signal(base);
  const comments = [];
  const m = mount(() => h(PostCard, { post, onLike: (on) => post.set({ ...post(), liked: on, likes: post().likes + (on ? 1 : -1) }), onComment: (p) => comments.push(p.id) }));
  const art = m.el.querySelector("article.hm-post");
  assert.equal(art.getAttribute("aria-label"), "Post by Acme Club");
  assert.ok(art.querySelector(".hm-post-verified"));
  assert.equal(art.querySelectorAll(".hm-mgrid-tile").length, 2);
  const like = art.querySelector("button.hm-like");
  like.click();
  assert.equal(post().liked, true);
  assert.equal(post().likes, 10);
  assert.equal(like.getAttribute("aria-pressed"), "true");
  const c = [...art.querySelectorAll(".hm-post-act")].find((b) => b.getAttribute("aria-label") === "Comments: 3");
  assert.ok(c);
  c.click();
  art.querySelector(".hm-post-all").click();
  assert.deepEqual(comments, ["p", "p"]);
  assert.equal(art.querySelector("time").textContent.length > 0, true);
  m.dispose();
});

test("PostCard: no media, no share count, no menu → those parts are absent", () => {
  const m = mount(() => h(PostCard, { post: { ...base, media: [] } }));
  assert.equal(m.el.querySelector(".hm-post-media"), null);
  assert.equal(m.el.querySelector(".hm-post-more"), null);
  assert.equal(m.el.querySelectorAll(".hm-post-act").length, 1, "comments shown read-only, shares hidden at 0");
  m.dispose();
});
