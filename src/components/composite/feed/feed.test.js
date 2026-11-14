import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Feed } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const post = (i) => ({ id: `p${i}`, author: { name: `Club ${i}` }, time: new Date(), text: "x", likes: i, comments: 0, shares: 0 });

test("Feed: skeleton while loading, then posts in a list; load more once; end mark", async () => {
  const posts = signal([]), loading = signal(true), more = signal(true);
  let pages = 0;
  const m = mount(() => h(Feed, { posts, loading, hasMore: more, onLoadMore: async () => { pages++; posts.set([...posts(), post(9)]); more.set(false); } }));
  assert.equal(m.el.querySelector(".hm-feed-list").getAttribute("aria-busy"), "true");
  assert.equal(m.el.querySelectorAll(".hm-feed-skel").length, 3);
  posts.set([post(1), post(2)]); loading.set(false);
  await wait();
  assert.equal(m.el.querySelector("[role=list]").getAttribute("aria-label"), "Feed");
  assert.ok(m.el.querySelectorAll("article.hm-post").length >= 2);
  await wait(80);
  assert.equal(pages, 1, "the end was near: next page loaded once");
  assert.match(m.el.querySelector(".hm-feed-end").textContent, /caught up/);
  m.dispose();
});

test("Feed: new posts pill and empty state", () => {
  const n = signal(3);
  let shown = 0;
  const m = mount(() => h(Feed, { posts: [], newCount: n, onShowNew: () => { shown++; n.set(0); } }));
  assert.match(m.el.querySelector(".hm-feed-empty").textContent, /No posts/);
  const pill = m.el.querySelector(".hm-feed-new");
  assert.match(pill.textContent, /3 new posts/);
  pill.click();
  assert.equal(shown, 1);
  assert.equal(m.el.querySelector(".hm-feed-new"), null);
  m.dispose();
});

test("Feed: own end mark, own post renderer, skeleton count, own texts and pill", async () => {
  const posts = signal([post(1)]);
  const m = mount(() => h(Feed, { posts, hasMore: false, class: "mine", end: "The end", renderPost: (p) => h("div", { class: "own-post" }, () => p().id), newCount: 2, newPill: (n) => `${n} fresh`, newColor: "brand-purple", motion: false }));
  await wait();
  assert.ok(m.el.querySelector(".hm-feed").classList.contains("mine"));
  assert.equal(m.el.querySelector(".own-post").textContent, "p1");
  assert.equal(m.el.querySelector("article.hm-post"), null);
  assert.equal(m.el.querySelector(".hm-feed-end").textContent, "The end");
  assert.equal(m.el.querySelector(".hm-feed-end-dots"), null);
  const pill = m.el.querySelector(".hm-feed-new");
  assert.equal(pill.textContent, "2 fresh");
  assert.equal(pill.getAttribute("data-hm-color"), "brand-purple");
  m.dispose();
  const off = mount(() => h(Feed, { posts, hasMore: false, end: false, newCount: 2, newPill: false, postProps: { avatar: false } }));
  await wait();
  assert.equal(off.el.querySelector(".hm-feed-end"), null);
  assert.equal(off.el.querySelector(".hm-feed-new"), null);
  assert.ok(off.el.querySelector("article.hm-post"));
  assert.equal(off.el.querySelector("article.hm-post .hm-avatar"), null);
  off.dispose();
  const load = mount(() => h(Feed, { posts: [], loading: true, skeletons: 1, labels: { loading: "Wait" } }));
  assert.equal(load.el.querySelectorAll(".hm-feed-skel").length, 1);
  assert.equal(load.el.querySelector(".hm-feed-list").getAttribute("aria-label"), "Wait");
  load.dispose();
  const none = mount(() => h(Feed, { posts: [], labels: { empty: "Quiet here" } }));
  assert.equal(none.el.querySelector(".hm-feed-empty").textContent, "Quiet here");
  none.dispose();
});
