/// Next declares `*.module.css` but not a plain stylesheet, and TypeScript 6 checks side-effect
/// imports that earlier versions let through. `app/globals.css` is imported for its effect, so
/// the module has no shape worth describing — only existence.
declare module "*.css";
