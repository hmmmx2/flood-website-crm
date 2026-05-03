// React 19 CJS production build does not attach `act` to `require("react")`, but
// `react-dom/test-utils` calls `React.act`. Next/test often run with NODE_ENV=production.
if (process.env.NODE_ENV === "production") {
  process.env.NODE_ENV = "test";
}
