export default defineEventHandler((event) => {
  const url = event.path;

  if (url.startsWith("/admin/") || url === "/admin") {
    const rest = url.startsWith("/admin/") ? url.slice("/admin".length) : "/";
    return sendRedirect(event, `/app${rest}`, 301);
  }

  if (url.startsWith("/manager/") || url === "/manager") {
    const rest = url.startsWith("/manager/") ? url.slice("/manager".length) : "/";
    return sendRedirect(event, `/app${rest}`, 301);
  }
});
