import './globals.css';

export const metadata = {
  title: 'Threads Scout V2',
  description: 'Threads content research for creators.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
