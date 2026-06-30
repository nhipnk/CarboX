import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getProjects, getLeaderboard } from '../lib/api';

const features = [
  {
    icon: '🔗',
    title: 'Chống Double Counting',
    desc: 'Mỗi tín chỉ carbon mang Token ID duy nhất trên blockchain. Không thể bán một tín chỉ cho hai người.',
  },
  {
    icon: '💧',
    title: 'Thanh khoản tức thì',
    desc: 'Mua chính xác số lượng bạn cần — 1 token hay 10,000 token. Giao dịch 24/7 không cần môi giới.',
  },
  {
    icon: '🔥',
    title: 'Minh bạch tuyệt đối',
    desc: 'Mọi giao dịch đốt token đều được ghi vĩnh viễn on-chain. Bất kỳ ai cũng có thể xác minh.',
  },
  {
    icon: '📜',
    title: 'Chứng nhận NFT',
    desc: 'Sau khi retire carbon, nhận ngay NFT Soulbound làm bằng chứng không thể làm giả cho kiểm toán CBAM.',
  },
];

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
};

const Home: NextPage = () => {
  const [stats, setStats] = useState([
    { value: '—', label: 'Dự án xanh' },
    { value: '—', label: 'Token đã phát hành' },
    { value: '—', label: 'Tấn CO₂ đã bù đắp' },
    { value: '—', label: 'Doanh nghiệp tham gia' },
  ]);

  useEffect(() => {
    const load = async () => {
      try {
        const [projects, leaderboardResponse] = await Promise.all([
          getProjects(),
          getLeaderboard(),
        ]);

        const approvedProjects = projects.filter((p) => p.status === 'Approved');
        const totalTokensMinted = approvedProjects.reduce((s, p) => s + (p.totalCarbon ?? 0), 0);
        const leaderboard = Array.isArray(leaderboardResponse?.leaderboard)
          ? leaderboardResponse.leaderboard
          : [];
        const totalRetired = leaderboard.reduce((s, e) => s + e.totalRetired, 0);
        const totalCompanies = leaderboard.length;

        setStats([
          { value: approvedProjects.length.toString(), label: 'Dự án xanh' },
          { value: formatNumber(totalTokensMinted), label: 'Token đã phát hành' },
          { value: formatNumber(totalRetired), label: 'kg CO₂ đã bù đắp' },
          { value: totalCompanies.toString(), label: 'Doanh nghiệp tham gia' },
        ]);
      } catch (e) {
        console.error('Home stats error:', e);
        // Giữ nguyên '—' nếu lỗi, không crash trang
      }
    };
    load();
  }, []);

  return (
    <>
      <Head>
        <title>CarboX — Sàn giao dịch tín chỉ carbon</title>
      </Head>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">

        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-base font-medium">🌿Kết nối giá trị xanh - Kiến tạo tương lai bền vững🌱 </span>
        </div>

        {/* Tiêu đề */}
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight flex items-center justify-center gap-2 flex-wrap">
          <img src="/logo.jpg" alt="CarboX" className="w-16 h-16 md:w-24 md:h-24 rounded-2xl object-cover inline-block" />
          <span>CarboX</span>
        </h1>
        <p className="text-5xl md:text-7xl font-black text-green-400 mb-6 leading-tight text-center">
          Sàn giao dịch tín chỉ Carbon
        </p>

        {/* Mô tả */}
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          CarboX — nền tảng token hóa tín chỉ Carbon.
          <br />
          Mua, bán và trung hòa Carbon minh bạch và nhanh chóng.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 items-center mb-12">
          <Link
            href="/marketplace"
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-xl text-lg transition-all duration-200 hover:scale-105"
          >
            Khám phá Marketplace →
          </Link>
          <Link
            href="/retire"
            className="border border-green-500/50 hover:border-green-400 text-green-400 font-semibold px-8 py-4 rounded-xl text-lg transition-all duration-200 hover:bg-green-500/10"
          >
            Trung hòa Carbon
          </Link>
        </div>

        {/* Stats — tự động cập nhật từ API */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-green-500/30 transition-all"
            >
              <p className="text-3xl font-bold text-green-400">{stat.value}</p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Tại sao chọn <span className="text-green-400">CarboX</span>?
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Nền tảng giải quyết những vấn đề hiện hữu về giao dịch tín chỉ Carbon
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white/3 border border-white/10 rounded-2xl p-8 hover:border-green-500/40 hover:bg-green-500/5 transition-all duration-300"
            >
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-white font-bold text-xl mb-3">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto border border-green-500/20 rounded-3xl p-12 bg-green-500/5">
          <h2 className="text-3xl font-bold text-white mb-4">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="text-gray-400 mb-8">
            Kết nối ví và tham gia thị trường giao dịch tín chỉ Carbon ngay hôm nay!
          </p>
          <Link
            href="/marketplace"
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded-xl text-lg transition-all duration-200 hover:scale-105 inline-block"
          >
            Bắt đầu ngay →
          </Link>
        </div>
      </section>
    </>
  );
};

export default Home;
