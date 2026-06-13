interface Project {
  id: number;
  name: string;
  location: string;
  totalTokens: number;
  soldTokens: number;
  pricePerToken: number;
  ipfsHash: string;
  standard: string;
  description: string;
  status: string;
}

const ProjectCard = ({ project }: { project: Project }) => {
  const progress = Math.round((project.soldTokens / project.totalTokens) * 100);
  const isSoldOut = project.status === 'soldout';

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden hover:border-green-500/40 transition-all duration-300 flex flex-col">
      <div className="h-48 bg-gradient-to-br from-green-900/40 to-black flex items-center justify-center relative">
        <span className="text-6xl">🌿</span>
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-bold text-lg border border-white/30 px-4 py-2 rounded-full">
              Đã hết
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3 bg-green-500/20 border border-green-500/40 rounded-full px-3 py-1">
          <span className="text-green-400 text-xs font-semibold">{project.standard}</span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-white font-bold text-lg mb-1">{project.name}</h3>
        <p className="text-gray-500 text-sm mb-3">📍 {project.location}</p>
        <p className="text-gray-400 text-sm mb-4 leading-relaxed flex-1">{project.description}</p>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>{project.soldTokens.toLocaleString()} token đã bán</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-gray-500 text-xs mt-1">Tổng: {project.totalTokens.toLocaleString()} tCO₂</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">Giá / token</p>
            <p className="text-green-400 font-bold text-xl">{project.pricePerToken} ETH</p>
          </div>
          <div className="flex gap-2">
            
              <button
                onClick={() => window.open("https://ipfs.io/ipfs/" + project.ipfsHash, "_blank")}
                className="border border-white/20 hover:border-white/40 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-all"
              >
            📄 IPFS
            </button>
            
            </div>
            <button
              disabled={isSoldOut}
              className={isSoldOut
                ? 'px-4 py-2 rounded-lg text-sm font-semibold bg-white/10 text-gray-500 cursor-not-allowed'
                : 'px-4 py-2 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-400 text-black'
              }
            >
              {isSoldOut ? 'Hết hàng' : 'Mua Token'}
            </button>
          </div>
        </div>
      </div>
  );
};

export default ProjectCard;