import "./globals.css";

export const metadata = {
  title: "递归摘要对话记忆 POC",
  description:
    "基于论文《递归摘要使大型语言模型具备长期对话记忆》的 Next.js 验证项目。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
