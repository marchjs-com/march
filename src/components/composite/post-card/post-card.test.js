import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { PostCard } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const base = { id: "p", author: { name: "HADİ Club", handle: "hadisosyal", verified: true }, time: new Date(Date.now() - 5 * 60_000), text: "Hello", likes: 9, liked: false, comments: 3, shares: 0, media: [{ src: "a.svg", alt: "a" }, { src: "b.svg", alt: "b" }] };

test("PostCard: article, author, media, like toggles through onLike, counts are named buttons", () => {
  const post = signal(base);
  const comments = [];
  const m = mount(() => h(PostCard, { post, onLike: (on) => post.set({ ...post(), liked: on, likes: post().likes + (on ? 1 : -1) }), onComment: (p) => comments.push(p.id) }));
  const art = m.el.querySelector("article.m-post");
  assert.equal(art.getAttribute("aria-label"), "Post by HADİ Club");
  assert.ok(art.querySelector(".m-post-verified"));
  assert.equal(art.querySelectorAll(".m-mgrid-tile").length, 2);
  const like = art.querySelector("button.m-like");
  like.click();
  assert.equal(post().liked, true);
  assert.equal(post().likes, 10);
  assert.equal(like.getAttribute("aria-pressed"), "true");
  const c = [...art.querySelectorAll(".m-post-act")].find((b) => b.getAttribute("aria-label") === "Comments: 3");
  assert.ok(c);
  c.click();
  art.querySelector(".m-post-all").click();
  assert.deepEqual(comments, ["p", "p"]);
  assert.equal(art.querySelector("time").textContent.length > 0, true);
  m.dispose();
});

test("PostCard: no media, no share count, no menu → those parts are absent", () => {
  const m = mount(() => h(PostCard, { post: { ...base, media: [] } }));
  assert.equal(m.el.querySelector(".m-post-media"), null);
  assert.equal(m.el.querySelector(".m-post-more"), null);
  assert.equal(m.el.querySelectorAll(".m-post-act").length, 1, "comments shown read-only, shares hidden at 0");
  m.dispose();
});

test("PostCard: own texts and icons; avatar, time, verified mark, large heart and the comments line can be turned off", () => {
  const mark = document.createElement("i"); mark.className = "own-comment";
  const m = mount(() => h(PostCard, {
    post: { ...base, place: "Shore" }, onComment: () => {}, class: "mine", avatar: false, time: false, verifiedIcon: false, placeIcon: false, bigHeart: false, viewAll: false,
    commentIcon: mark, likeColor: "brand-orange", labels: { post: (a) => `From ${a}`, comments: (n) => `${n} answers` },
  }));
  const art = m.el.querySelector("article.m-post");
  assert.ok(art.classList.contains("mine"));
  assert.equal(art.getAttribute("aria-label"), "From HADİ Club");
  assert.equal(art.querySelector(".m-avatar"), null);
  assert.equal(art.querySelector("time"), null);
  assert.equal(art.querySelector(".m-post-verified"), null);
  assert.equal(art.querySelector(".m-post-place svg"), null);
  assert.equal(art.querySelector(".m-post-big"), null);
  assert.equal(art.querySelector(".m-post-all"), null);
  const c = art.querySelector(".m-post-act");
  assert.equal(c.getAttribute("aria-label"), "3 answers");
  assert.ok(c.querySelector(".own-comment"));
  m.dispose();
  const own = mount(() => h(PostCard, { post: base, time: () => "just now", bigHeart: "★" }));
  assert.equal(own.el.querySelector("time").textContent, "just now");
  assert.equal(own.el.querySelector(".m-post-big").textContent, "★");
  own.dispose();
});
