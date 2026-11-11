// Type tests: registered routes make navigate()/Link reject unknown paths.
import { navigate, fillPath, type ParamsOf } from "../../src/router/index.ts";

declare module "../../src/router/index.ts" {
  interface Register { routes: "/" | "/users/:id" | "/docs/*slug" }
}

void navigate("/");
void navigate("/users/42");
void navigate("/users/42?tab=info");
void navigate("/docs/a/b");
// @ts-expect-error — not a registered route
void navigate("/nope");
// @ts-expect-error — missing the :id segment
void navigate("/users");

const p: ParamsOf<"/users/:id/files/:file"> = { id: "1", file: "a" };
// @ts-expect-error — missing param
const q: ParamsOf<"/users/:id"> = {};
void p; void q; void fillPath;
