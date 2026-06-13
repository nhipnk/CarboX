const express = require('express');
const router = express.Router();
const Project = require('../Models/Project');
const User = require('../Models/User');
const { approveAndMintOnChain, getProjectOnChain, voteOnProject } = require('../services/blockchainService');

// ── Middleware kiểm tra Admin key ─────────────────────────────
const requireAdmin = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: '⛔ Không có quyền Admin!' });
    }
    next();
};

// ==========================================
// 1. TẠO DỰ ÁN MỚI
// POST /api/projects/create
// Body: { projectName, ownerWallet, ipfsHash, totalCarbon }
// ==========================================
router.post('/create', async (req, res) => {
    try {
        const { projectName, ownerWallet, ipfsHash, totalCarbon } = req.body;

        if (!projectName || !ownerWallet || !ipfsHash || !totalCarbon) {
            return res.status(400).json({ error: 'Vui lòng cung cấp đủ thông tin và mã băm IPFS!' });
        }

        // FIX: Kiểm tra project đã tồn tại (same wallet + same IPFS hash)
        const existing = await Project.findOne({
            ownerWallet: ownerWallet.toLowerCase(),
            ipfsHash,
        });

        if (existing) {
            // Project đã tồn tại, trả về existing (tránh double-create)
            return res.status(201).json({
                message: '🎉 Dự án đã tồn tại (hoặc đã được submit trước đó).',
                project: existing,
            });
        }

        const newProject = new Project({
            projectName,
            ownerWallet: ownerWallet.toLowerCase(),
            ipfsHash,
            totalCarbon,
            status: 'Pending',
        });

        await newProject.save();

        res.status(201).json({
            message: '🎉 Tạo dự án thành công! Admin sẽ xét duyệt trong 1-3 ngày.',
            project: newProject,
        });
    } catch (error) {
        console.error('❌ Lỗi khi tạo dự án:', error);
        res.status(500).json({ error: 'Lỗi server, không thể tạo dự án.' });
    }
});

// ==========================================
// 2. THỐNG KÊ TỔNG QUAN
// GET /api/projects/stats
// ==========================================
router.get('/stats', async (req, res) => {
    try {
        const totalApprovedProjects = await Project.countDocuments({ status: 'Approved' });

        const projectAggregation = await Project.aggregate([
            { $match: { status: 'Approved' } },
            { $group: { _id: null, totalAvailableCarbon: { $sum: '$totalCarbon' } } },
        ]);
        const totalAvailableCarbon = projectAggregation[0]?.totalAvailableCarbon || 0;

        const userAggregation = await User.aggregate([
            { $group: { _id: null, totalRetiredCarbon: { $sum: '$totalRetired' } } },
        ]);
        const totalRetiredCarbon = userAggregation[0]?.totalRetiredCarbon || 0;

        res.status(200).json({ totalApprovedProjects, totalAvailableCarbon, totalRetiredCarbon });
    } catch (error) {
        console.error('❌ Lỗi khi lấy thống kê:', error);
        res.status(500).json({ error: 'Không thể tải dữ liệu thống kê.' });
    }
});

// ==========================================
// 3. LẤY DANH SÁCH DỰ ÁN CÔNG KHAI
// GET /api/projects?status=approved|pending|rejected|all
// ==========================================
router.get('/', async (req, res) => {
    try {
        const status = req.query.status?.toString().toLowerCase();
        let filter = { status: 'Approved' };

        if (status === 'all') {
            filter = {};
        } else if (status === 'pending') {
            filter = { status: 'Pending' };
        } else if (status === 'rejected') {
            filter = { status: 'Rejected' };
        } else if (status === 'approved') {
            filter = { status: 'Approved' };
        }

        const projects = await Project.find(filter).sort({ createdAt: -1 });
        res.status(200).json(projects);
    } catch (error) {
        console.error('❌ Lỗi truy xuất dự án:', error);
        res.status(500).json({ error: 'Không thể lấy danh sách dự án.' });
    }
});

// ==========================================
// 4. LẤY DANH SÁCH DỰ ÁN CHỜ DUYỆT (Admin)
// GET /api/projects/pending
// Header: x-admin-key
// ==========================================
router.get('/pending', requireAdmin, async (req, res) => {
    try {
        const pendingProjects = await Project.find({ status: 'Pending' }).sort({ createdAt: -1 });
        res.status(200).json(pendingProjects);
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách pending:', error);
        res.status(500).json({ error: 'Không thể tải danh sách dự án chờ duyệt.' });
    }
});

// ==========================================
// 5. LẤY DANH SÁCH DỰ ÁN ĐÃ TỪ CHỐI (Admin)
// GET /api/projects/rejected
// Header: x-admin-key
// ==========================================
router.get('/rejected', requireAdmin, async (req, res) => {
    try {
        const rejectedProjects = await Project.find({ status: 'Rejected' }).sort({ createdAt: -1 });
        res.status(200).json(rejectedProjects);
    } catch (error) {
        console.error('❌ Lỗi lấy danh sách rejected:', error);
        res.status(500).json({ error: 'Không thể tải danh sách dự án bị từ chối.' });
    }
});

// ==========================================
// 6. PHÊ DUYỆT DỰ ÁN (Admin)
// PUT /api/projects/approve/:id
// Header: x-admin-key
// Body: { onChainProjectId, approvedCO2Kg, tokenURI }
// ==========================================
router.put('/approve/:id', requireAdmin, async (req, res) => {
    try {
        const projectId = req.params.id.trim();
        const { onChainProjectId, approvedCO2Kg, tokenURI } = req.body;

        if (!onChainProjectId || !approvedCO2Kg || !tokenURI) {
            return res.status(400).json({
                error: 'Thiếu thông tin bắt buộc!',
                required: {
                    onChainProjectId: 'ID dự án trên blockchain (lấy từ event ProjectSubmitted)',
                    approvedCO2Kg: 'Lượng CO2 xác nhận (kg)',
                    tokenURI: 'Link IPFS metadata token (ipfs://...)',
                },
            });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Không tìm thấy dự án này trong hệ thống!' });
        }
        if (project.status === 'Approved') {
            return res.status(400).json({ error: 'Dự án này đã được duyệt rồi!' });
        }

        console.log(`⏳ Đang gọi approveAndMint lên blockchain cho dự án onChain #${onChainProjectId}...`);
        const { txHash, blockNumber } = await approveAndMintOnChain(
            onChainProjectId,
            approvedCO2Kg,
            tokenURI
        );

        const updatedProject = await Project.findByIdAndUpdate(
            projectId,
            {
                status: 'Approved',
                onChainProjectId: Number(onChainProjectId),
                approvedCO2Kg: Number(approvedCO2Kg),
            },
            { returnDocument: 'after' }
        );

        res.status(200).json({
            message: '✅ Dự án đã được duyệt và mint token thành công trên blockchain!',
            txHash,
            blockNumber,
            project: updatedProject,
        });

    } catch (error) {
        console.error('❌ Lỗi khi duyệt dự án:', error.message);

        if (error.code === 'CALL_EXCEPTION') {
            return res.status(400).json({
                error: 'Blockchain từ chối giao dịch. Kiểm tra: onChainProjectId có đúng không?',
                details: error.reason || error.message,
            });
        }

        res.status(500).json({ error: 'Lỗi server khi xử lý phê duyệt.', details: error.message });
    }
});

// ==========================================
// 7. TỪ CHỐI DỰ ÁN (Admin)
// PUT /api/projects/reject/:id
// Header: x-admin-key
// Body: { reason } (không bắt buộc)
// ==========================================
router.put('/reject/:id', requireAdmin, async (req, res) => {
    try {
        const projectId = req.params.id.trim();
        const { reason } = req.body;

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Không tìm thấy dự án này trong hệ thống!' });
        }
        if (project.status === 'Rejected') {
            return res.status(400).json({ error: 'Dự án này đã bị từ chối rồi!' });
        }
        if (project.status === 'Approved') {
            return res.status(400).json({ error: 'Không thể từ chối dự án đã được duyệt!' });
        }

        const updatedProject = await Project.findByIdAndUpdate(
            projectId,
            {
                status: 'Rejected',
                ...(reason && { rejectReason: reason }),
            },
            { returnDocument: 'after' }
        );

        console.log(`❌ Dự án ${project.projectName} bị từ chối. Lý do: ${reason || 'Không có'}`);

        res.status(200).json({
            message: '❌ Dự án đã bị từ chối.',
            project: updatedProject,
        });

    } catch (error) {
        console.error('❌ Lỗi khi từ chối dự án:', error.message);
        res.status(500).json({ error: 'Lỗi server khi xử lý từ chối.', details: error.message });
    }
});

// ==========================================
// 8. XÓA DỰ ÁN (Admin)
// DELETE /api/projects/:id
// Header: x-admin-key
// ==========================================
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const projectId = req.params.id.trim();
        const deleted = await Project.findByIdAndDelete(projectId);
        if (!deleted) {
            return res.status(404).json({ error: 'Không tìm thấy dự án!' });
        }
        res.status(200).json({ message: '🗑️ Đã xóa dự án thành công.' });
    } catch (error) {
        console.error('❌ Lỗi khi xóa dự án:', error.message);
        res.status(500).json({ error: 'Lỗi server khi xóa dự án.', details: error.message });
    }
});

// ==========================================
// 9. VOTE DỰ ÁN (Admin/Validator)
// POST /api/projects/vote/:onChainProjectId
// Header: x-admin-key
// Body: { approve } (mặc định true)
// ==========================================
router.post('/vote/:onChainProjectId', requireAdmin, async (req, res) => {
    try {
        const onChainProjectId = Number(req.params.onChainProjectId);
        const approve = req.body.approve !== false; // mặc định true

        if (!onChainProjectId) {
            return res.status(400).json({ error: 'Thiếu onChainProjectId!' });
        }

        console.log(`🗳️ Đang vote ${approve ? 'duyệt' : 'từ chối'} dự án #${onChainProjectId}...`);

        const { txHash, blockNumber } = await voteOnProject(onChainProjectId, approve);

        res.status(200).json({
            message: `✅ Đã vote ${approve ? 'duyệt' : 'từ chối'} dự án #${onChainProjectId} thành công!`,
            txHash,
            blockNumber,
        });

    } catch (error) {
        const message = String(error?.message || error || '');
        let errorText = message.toLowerCase();
        try {
            if (error && typeof error === 'object') {
                const extra = JSON.stringify(error, Object.getOwnPropertyNames(error));
                if (extra) {
                    errorText += ' ' + extra.toLowerCase();
                }
            }
        } catch (ignore) {
            // ignore JSON serialization failures
        }
        console.error('❌ Lỗi khi vote dự án:', errorText);

        if (errorText.includes('da bo phieu')) {
            return res.status(400).json({ error: 'Ví Admin đã vote cho dự án này rồi!' });
        }
        if (errorText.includes('khong phai validator')) {
            return res.status(400).json({ error: 'Ví Admin chưa được thêm làm Validator!' });
        }
        if (errorText.includes('khong the bau phieu') || errorText.includes('cannot vote')) {
            return res.status(400).json({ error: 'Không thể vote dự án vì validator hiện tại là chủ dự án.', details: message });
        }

        res.status(500).json({ error: 'Lỗi khi vote dự án.', details: message });
    }
});

module.exports = router;