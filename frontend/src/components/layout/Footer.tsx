import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="border-t border-white/10 mt-20" style={{ background: 'linear-gradient(to bottom, #0a0f0a, #000)' }}>
      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

          {/* Logo + mô tả */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                <span className="text-black font-black text-sm">C</span>
              </div>
              <span className="text-white font-bold text-xl">
                Carbo<span className="text-green-400">X</span>
              </span>
            </Link>

            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Nền tảng giao dịch tín chỉ carbon minh bạch do CarboX phát triển, giúp kết nối người mua và người bán tín chỉ carbon một cách dễ dàng và hiệu quả.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => window.open('#', '_blank')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 text-sm font-bold transition-all duration-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white hover:shadow-lg hover:scale-110"
              >
                f
              </button>
              <button
                onClick={() => window.open('#', '_blank')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 text-sm font-bold transition-all duration-300 hover:bg-white hover:border-white hover:text-black hover:shadow-lg hover:scale-110"
              >
                X
              </button>
              <button
                onClick={() => window.open('#', '_blank')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 text-sm font-bold transition-all duration-300 hover:bg-pink-600 hover:border-pink-500 hover:text-white hover:shadow-lg hover:scale-110"
              >
                IG
              </button>
            </div>
          </div>

          {/* About Us */}
          <div>
            <h4 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">
              About Us
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Về CarboX', href: '#' },
                { label: 'Sứ mệnh', href: '#' },
                { label: 'Đội ngũ', href: '#' },
                { label: 'Đối tác', href: '#' },
                { label: 'Github', href: 'https://github.com/nhipnk/CarboX', external: true },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-gray-500 hover:text-green-400 text-sm transition-all duration-200 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-green-400 transition-all" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Guides */}
          <div>
            <h4 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">
              Guides
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Bắt đầu nhanh', href: '#' },
                { label: 'Cách mua Token', href: '/marketplace' },
                { label: 'Cách Retire Carbon', href: '/retire' },
                { label: 'Tín chỉ carbon là gì?', href: 'https://youtu.be/D9Fav9-XxB8?si=LbSgkPkCvoSoZERg' },
                { label: 'Hướng dẫn kết nối ví', href: '#' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-gray-500 hover:text-green-400 text-sm transition-all duration-200 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-green-400 transition-all" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Transaction */}
          <div>
            <h4 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">
              Contact
            </h4>
            <ul className="space-y-3 mb-8">
              {[
                { label: 'hello@carbox.vn', icon: '📧', href: 'mailto:hello@carbox.vn' },
                { label: 'Discord', icon: '💬', href: '#' },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => { if (item.href !== '#') window.location.href = item.href; }}
                    className="text-gray-500 hover:text-green-400 text-sm transition-all duration-200 flex items-center gap-2"
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>

            <h4 className="text-white font-bold mb-5 text-sm uppercase tracking-widest">
              Transaction
            </h4>
            <ul className="space-y-3">
              {[
                { label: 'Xem trên Etherscan', href: 'https://sepolia.etherscan.io/address/0xBb1d739d98dAe76DD1E95e4A978Fd1E4b525ABa4', external: true },
                { label: 'Leaderboard', href: '/leaderboard', external: false },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => {
                      if (item.external) window.open(item.href, '_blank');
                      else if (item.href !== '#') window.location.href = item.href;
                    }}
                    className="text-gray-500 hover:text-green-400 text-sm transition-all duration-200 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-green-400 transition-all" />
                    {item.label}
                    {item.external && <span className="text-xs opacity-50">↗</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="border-t border-white/10" />
          <div className="absolute left-1/2 -translate-x-1/2 -top-px w-32 h-px bg-green-500/50" />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-sm">
            © 2026 <span className="text-gray-400">CarboX</span>. All rights reserved.
          </p>
          <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400/70 text-xs font-medium">Powered by Blockchain · Sepolia Testnet</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
