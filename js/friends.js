/**
 * 朋友圈功能模块 - 仿微信朋友圈高级版
 * 与"传讯"聊天系统集成，使用localforage存储
 * 支持多角色：用户自己 + 梦角们
 */

(function() {
    'use strict';

    // 防止重复加载
    if (window.FriendsModule) return;

    // ===== 配置 =====
    const CONFIG = {
        STORAGE_KEY: 'friends_posts',
        MAX_IMAGES: 9,
        IMAGE_QUALITY: 0.8,
        MAX_IMAGE_SIZE: 1024
    };

    // ===== 当前选中的发布身份 =====
    let currentPublishIdentity = 'user'; // 默认为用户自己

    // ===== 注入身份选择功能所需的样式 =====
    function injectIdentityStyles() {
        if (document.getElementById('friends-identity-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'friends-identity-styles';
        style.textContent = `
            /* 发布弹窗身份显示 */
            .friends-publish-identity-display {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                padding: 6px 12px;
                border-radius: 20px;
                background: rgba(var(--friends-accent-rgb), 0.1);
                border: 1px solid rgba(var(--friends-accent-rgb), 0.2);
                transition: all 0.2s ease;
            }
            .friends-publish-identity-display:hover {
                background: rgba(var(--friends-accent-rgb), 0.15);
            }
            .friends-publish-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                overflow: hidden;
                border: 1px solid rgba(var(--friends-accent-rgb), 0.3);
                background: var(--secondary-bg);
            }
            .friends-publish-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .friends-publish-avatar i {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary);
                font-size: 12px;
            }
            .friends-publish-current-name {
                font-size: 13px;
                color: var(--text-primary);
                font-weight: 500;
            }
            .friends-publish-identity-display i.fa-chevron-down {
                font-size: 10px;
                color: var(--text-secondary);
                transition: transform 0.2s ease;
            }
            
            /* 身份选择器下拉 */
            .friends-publish-identity-selector {
                position: relative;
            }
            .friends-publish-identity-selector .friends-identity-label {
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: 8px;
                opacity: 0.7;
            }
            .friends-publish-identity-selector .friends-identity-list {
                display: none;
                flex-wrap: wrap;
                gap: 8px;
                padding: 12px;
                background: var(--secondary-bg);
                border-radius: 12px;
                border: 1px solid rgba(var(--friends-accent-rgb), 0.15);
                margin-bottom: 12px;
            }
            .friends-publish-identity-selector.expanded .friends-identity-list {
                display: flex;
            }
            .friends-identity-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                border-radius: 20px;
                background: rgba(var(--friends-accent-rgb), 0.08);
                border: 1px solid transparent;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .friends-identity-item:hover {
                background: rgba(var(--friends-accent-rgb), 0.15);
            }
            .friends-identity-item.selected {
                background: rgba(var(--friends-accent-rgb), 0.2);
                border-color: rgba(var(--friends-accent-rgb), 0.4);
            }
            .friends-identity-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                overflow: hidden;
                border: 1px solid rgba(var(--friends-accent-rgb), 0.2);
                background: var(--border-color);
            }
            .friends-identity-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .friends-identity-avatar i {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary);
                font-size: 14px;
            }
            .friends-identity-name {
                font-size: 13px;
                color: var(--text-primary);
                font-weight: 500;
            }
            .friends-identity-check {
                font-size: 12px;
                color: var(--friends-accent);
                margin-left: 4px;
            }
            
            /* 发布按钮容器调整 */
            .friends-publish-footer {
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .friends-publish-footer .friends-publish-identity-selector {
                width: 100%;
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // ===== 获取梦角列表（从 partnerPersonas 加载）=====
    async function getPartnerPersonas() {
        try {
            if (typeof localforage !== 'undefined' && typeof getStorageKey !== 'undefined') {
                const personas = await localforage.getItem(getStorageKey('partnerPersonas'));
                return personas || [];
            }
        } catch (e) {
            console.error('获取梦角列表失败:', e);
        }
        return [];
    }

    // ===== 获取所有用户列表 =====
    async function getAllUsers() {
        const users = [];
        
        // 获取用户自己
        const myAvatarEl = document.querySelector('#my-avatar img');
        const myAvatar = myAvatarEl ? myAvatarEl.src : '';
        const myName = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
        users.push({
            id: 'user',
            name: myName,
            avatar: myAvatar,
            type: 'self'
        });

        // 获取梦角列表
        const personas = await getPartnerPersonas();
        personas.forEach((persona, index) => {
            users.push({
                id: 'persona_' + index,
                name: persona.name || '梦角',
                avatar: persona.avatar || '',
                type: 'persona'
            });
        });

        return users;
    }

    // ===== 根据 userId 获取用户信息 =====
    async function getUserById(userId) {
        const users = await getAllUsers();
        const user = users.find(u => u.id === userId);
        if (user) return user;
        
        // 如果找不到，返回默认用户自己
        return users.find(u => u.id === 'user') || {
            id: 'user',
            name: '未知用户',
            avatar: '',
            type: 'self'
        };
    }

    // ===== 获取当前用户（用户自己）=====
    function getCurrentUser() {
        const avatarEl = document.querySelector('#my-avatar img');
        const avatar = avatarEl ? avatarEl.src : '';
        const name = (typeof settings !== 'undefined' && settings.myName) ? settings.myName : '我';
        return { id: 'user', name, avatar, type: 'self' };
    }

    // ===== 获取当前选中的身份（用于发布、点赞、评论）=====
    async function getCurrentIdentity() {
        return await getUserById(currentPublishIdentity);
    }

    // ===== 时间格式化 =====
    function formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        if (diff < minute) return '刚刚';
        if (diff < hour) return Math.floor(diff / minute) + '分钟前';
        if (diff < day) return Math.floor(diff / hour) + '小时前';
        if (diff < 2 * day) return '昨天';
        if (diff < 7 * day) return Math.floor(diff / day) + '天前';
        
        const date = new Date(timestamp);
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        return month + '月' + dayNum + '日';
    }

    // ===== 生成唯一ID =====
    function generateId() {
        return 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ===== 图片处理 =====
    async function compressImage(file, maxSize = CONFIG.MAX_IMAGE_SIZE) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = Math.round(height * maxSize / width);
                            width = maxSize;
                        } else {
                            width = Math.round(width * maxSize / height);
                            height = maxSize;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', CONFIG.IMAGE_QUALITY));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ===== 本地存储 =====
    async function getPosts() {
        try {
            if (typeof localforage !== 'undefined') {
                const posts = await localforage.getItem(CONFIG.STORAGE_KEY);
                return posts || [];
            }
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('获取朋友圈数据失败:', e);
            return [];
        }
    }

    async function savePosts(posts) {
        try {
            if (typeof localforage !== 'undefined') {
                await localforage.setItem(CONFIG.STORAGE_KEY, posts);
            } else {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(posts));
            }
        } catch (e) {
            console.error('保存朋友圈数据失败:', e);
        }
    }

    // ===== DOM元素 =====
    let friendsModal = null;
    let publishModal = null;
    let commentOverlay = null;
    let previewOverlay = null;
    let moreMenu = null;
    let deleteConfirm = null;
    let toastEl = null;

    let currentCommentPostId = null;
    let currentReplyTo = null;
    let currentPreviewIndex = 0;
    let currentPreviewImages = [];
    let selectedImages = [];
    let currentMorePostId = null;

    // ===== 创建星空背景 =====
    function createStars(container, count = 15) {
        for (let i = 0; i < count; i++) {
            const star = document.createElement('span');
            star.className = 'friends-star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 3 + 's';
            star.style.width = (Math.random() * 2 + 1) + 'px';
            star.style.height = star.style.width;
            container.appendChild(star);
        }
    }

    // ===== 渲染单条动态 =====
    async function renderPost(post, currentIdentity) {
        // 渲染时根据 userId 获取最新的用户信息
        const postUser = await getUserById(post.userId);
        const isLiked = post.likes.includes(currentIdentity.id);
        const isOwner = post.userId === currentIdentity.id;

        let imagesHtml = '';
        if (post.images && post.images.length > 0) {
            const gridClass = post.images.length === 1 ? 'one-image' :
                              post.images.length <= 4 ? 'two-images' : 'six-images';
            
            const imageItems = post.images.map((img, idx) => {
                if (post.images.length > 9 && idx === 8) {
                    return `
                        <div class="friends-image-item more-overlay" onclick="FriendsModule.previewImage(${idx})">
                            <img src="${img}" alt="图片">
                            <span class="friends-image-more-count">+${post.images.length - 8}</span>
                        </div>
                    `;
                }
                return `
                    <div class="friends-image-item" onclick="FriendsModule.previewImage(${idx})">
                        <img src="${img}" alt="图片" loading="lazy">
                    </div>
                `;
            }).join('');

            imagesHtml = `
                <div class="friends-post-images">
                    <div class="friends-images-grid ${gridClass}">
                        ${imageItems}
                    </div>
                </div>
            `;
        }

        // 渲染点赞列表 - 根据 userId 获取最新名字
        let likesHtml = '';
        if (post.likes.length > 0) {
            const likeNames = await Promise.all(post.likes.map(async userId => {
                const user = await getUserById(userId);
                return user.name;
            }));
            likesHtml = `
                <div class="friends-likes">
                    <i class="fas fa-heart friends-like-icon"></i>
                    ${likeNames.map(name => `<span class="friends-like-name">${name}</span>`).join('<span class="friends-like-separator">、</span>')}
                </div>
            `;
        }

        // 渲染评论列表 - 根据 userId 获取最新名字
        let commentsHtml = '';
        if (post.comments && post.comments.length > 0) {
            const commentHtmls = [];
            for (const comment of post.comments) {
                const commentAuthor = await getUserById(comment.userId);
                let replyHtmlContent = '';
                if (comment.replyTo) {
                    const replyUser = await getUserById(comment.replyTo);
                    replyHtmlContent = `<span class="friends-comment-reply">回复</span><span class="friends-comment-reply-name">${replyUser.name}</span>`;
                }
                
                commentHtmls.push(`
                    <div class="friends-comment" onclick="FriendsModule.openCommentInput('${post.id}', '${comment.id}')">
                        <span class="friends-comment-author">${commentAuthor.name}</span>
                        ${replyHtmlContent}
                        <span class="friends-comment-content">${comment.content}</span>
                        <span class="friends-comment-time">${formatTime(comment.time)}</span>
                    </div>
                `);
            }
            commentsHtml = `<div class="friends-comments">${commentHtmls.join('')}</div>`;
        }

        return `
            <div class="friends-post" data-post-id="${post.id}" data-user-id="${post.userId}" style="animation-delay: ${Math.random() * 0.2}s">
                <div class="friends-post-header">
                    <div class="friends-post-avatar" onclick="FriendsModule.openFriendProfile('${post.userId}')">
                        ${postUser.avatar ? `<img src="${postUser.avatar}" alt="头像">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="friends-post-user">
                        <div class="friends-post-name">${postUser.name}</div>
                        <div class="friends-post-text">${post.content}</div>
                        <div class="friends-post-time">${formatTime(post.createdAt)}</div>
                    </div>
                    <div class="friends-post-actions">
                        <div class="friends-post-more" onclick="FriendsModule.showMoreMenu(event, '${post.id}')">
                            <i class="fas fa-ellipsis-h"></i>
                        </div>
                    </div>
                </div>
                ${imagesHtml}
                <div class="friends-post-interaction">
                    ${likesHtml}
                    ${commentsHtml}
                </div>
                <div class="friends-post-bottom">
                    <div class="friends-action-btns">
                        <button class="friends-action-btn ${isLiked ? 'liked' : ''}" onclick="FriendsModule.toggleLike('${post.id}')">
                            <i class="fas fa-heart"></i>
                            <span>${isLiked ? '已赞' : '赞'}</span>
                        </button>
                        <button class="friends-action-btn" onclick="FriendsModule.openCommentInput('${post.id}')">
                            <i class="fas fa-comment"></i>
                            <span>评论</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== 渲染朋友圈列表 =====
    async function renderFriendsList() {
        const content = document.getElementById('friends-content');
        if (!content) return;

        const posts = await getPosts();
        const currentIdentity = await getCurrentIdentity();
        
        // 按时间倒序排列
        posts.sort((a, b) => b.createdAt - a.createdAt);

        if (posts.length === 0) {
            content.innerHTML = `
                <div class="friends-empty">
                    <div class="friends-empty-icon">
                        <i class="fas fa-feather-alt"></i>
                    </div>
                    <p class="friends-empty-text">
                        还没有发布任何动态<br>
                        点击右上角相机分享你的此刻
                    </p>
                </div>
            `;
            return;
        }

        // 渲染所有动态
        const postsHtml = [];
        for (const post of posts) {
            postsHtml.push(await renderPost(post, currentIdentity));
        }
        content.innerHTML = postsHtml.join('');
    }

    // ===== 刷新朋友圈 =====
    async function refreshFriends() {
        await renderFriendsList();
    }

    // ===== 打开朋友圈 =====
    function openFriends() {
        if (!friendsModal) createFriendsModal();
        friendsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        refreshFriends();
    }

    // ===== 关闭朋友圈 =====
    function closeFriends() {
        if (friendsModal) {
            friendsModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // ===== 创建朋友圈模态框 =====
    async function createFriendsModal() {
        const currentIdentity = await getCurrentIdentity();
        
        friendsModal = document.createElement('div');
        friendsModal.className = 'friends-modal-overlay';
        friendsModal.id = 'friends-modal';
        friendsModal.innerHTML = `
            <div class="friends-modal">
                <div class="friends-stars" id="friends-stars"></div>
                <div class="friends-header">
                    <div class="friends-header-left">
                        <div class="friends-avatar-cover">
                            ${currentIdentity.avatar ? `<img src="${currentIdentity.avatar}" alt="我的头像">` : '<i class="fas fa-user" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-secondary)"></i>'}
                        </div>
                        <div class="friends-user-info">
                            <span class="friends-user-name">${currentIdentity.name}</span>
                            <span class="friends-user-motto">${currentIdentity.type === 'self' ? '记录美好瞬间' : '以梦角的身份分享'}</span>
                        </div>
                    </div>
                    <div class="friends-header-right">
                        <div class="friends-camera-btn" onclick="FriendsModule.openPublish()" title="发布动态">
                            <i class="fas fa-camera"></i>
                        </div>
                        <button class="friends-close-btn" onclick="FriendsModule.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="friends-content" id="friends-content">
                    <div class="friends-loading">
                        <div class="friends-spinner"></div>
                        <span style="color:var(--text-secondary);font-size:14px;">加载中...</span>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(friendsModal);
        createStars(document.getElementById('friends-stars'));

        // 点击背景关闭
        friendsModal.addEventListener('click', (e) => {
            if (e.target === friendsModal) closeFriends();
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && friendsModal.classList.contains('active')) {
                if (publishModal && publishModal.classList.contains('active')) {
                    closePublish();
                } else {
                    closeFriends();
                }
            }
        });
    }

    // ===== 发布动态 =====
    async function openPublish() {
        if (!publishModal) await createPublishModal();
        
        // 重置发布表单
        publishModal.querySelector('.friends-textarea').value = '';
        selectedImages = [];
        currentPublishIdentity = 'user'; // 默认使用用户自己
        await renderPublishImages();
        await renderIdentitySelector();
        publishModal.classList.add('active');
    }

    function closePublish() {
        if (publishModal) {
            publishModal.classList.remove('active');
        }
    }

    // ===== 渲染身份选择器 =====
    async function renderIdentitySelector() {
        const selector = publishModal.querySelector('.friends-identity-selector');
        if (!selector) return;

        const allUsers = await getAllUsers();

        let html = '';
        for (const user of allUsers) {
            const isSelected = user.id === currentPublishIdentity;
            html += `
                <div class="friends-identity-item ${isSelected ? 'selected' : ''}" data-user-id="${user.id}" onclick="FriendsModule.selectIdentity('${user.id}')">
                    <div class="friends-identity-avatar">
                        ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <span class="friends-identity-name">${user.name}</span>
                    ${isSelected ? '<i class="fas fa-check friends-identity-check"></i>' : ''}
                </div>
            `;
        }

        selector.innerHTML = `
            <div class="friends-identity-label">选择发布身份</div>
            <div class="friends-identity-list">${html}</div>
        `;

        // 更新头部当前身份显示
        const currentIdentity = await getUserById(currentPublishIdentity);
        const headerAvatar = publishModal.querySelector('.friends-publish-avatar');
        const headerName = publishModal.querySelector('.friends-publish-current-name');
        
        if (headerAvatar) {
            const img = headerAvatar.querySelector('img');
            const icon = headerAvatar.querySelector('i');
            if (currentIdentity.avatar) {
                if (img) {
                    img.src = currentIdentity.avatar;
                    img.style.display = '';
                } else {
                    headerAvatar.innerHTML = `<img src="${currentIdentity.avatar}" alt="头像">`;
                }
            } else {
                if (img) img.style.display = 'none';
                if (icon) icon.style.display = '';
                else headerAvatar.innerHTML = '<i class="fas fa-user"></i>';
            }
        }
        if (headerName) {
            headerName.textContent = currentIdentity.name;
        }
    }

    // ===== 选择身份 =====
    async function selectIdentity(userId) {
        currentPublishIdentity = userId;
        await renderIdentitySelector();
    }

    async function createPublishModal() {
        // 注入身份选择所需的样式
        injectIdentityStyles();
        
        const allUsers = await getAllUsers();
        const currentIdentity = allUsers.find(u => u.id === 'user') || allUsers[0];

        publishModal = document.createElement('div');
        publishModal.className = 'friends-publish-overlay';
        publishModal.innerHTML = `
            <div class="friends-publish-modal">
                <div class="friends-publish-header">
                    <div class="friends-publish-identity-display" onclick="FriendsModule.toggleIdentitySelector()">
                        <div class="friends-publish-avatar">
                            ${currentIdentity.avatar ? `<img src="${currentIdentity.avatar}" alt="头像">` : '<i class="fas fa-user"></i>'}
                        </div>
                        <span class="friends-publish-current-name">${currentIdentity.name}</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <button class="friends-publish-close" onclick="FriendsModule.closePublish()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="friends-publish-content">
                    <textarea class="friends-textarea" placeholder="这一刻的想法..." maxlength="2000"></textarea>
                    <div class="friends-publish-images" id="publish-images"></div>
                </div>
                <div class="friends-publish-footer">
                    <div class="friends-publish-identity-selector" id="publish-identity-selector"></div>
                    <button class="friends-publish-btn cancel" onclick="FriendsModule.closePublish()">取消</button>
                    <button class="friends-publish-btn submit" onclick="FriendsModule.submitPost()">发布</button>
                </div>
            </div>
        `;

        document.body.appendChild(publishModal);

        // 点击其他地方收起身份选择器
        document.addEventListener('click', (e) => {
            const selector = publishModal.querySelector('.friends-publish-identity-selector');
            const display = publishModal.querySelector('.friends-publish-identity-display');
            if (selector && display && !selector.contains(e.target) && !display.contains(e.target)) {
                selector.classList.remove('expanded');
            }
        });

        publishModal.addEventListener('click', (e) => {
            if (e.target === publishModal) closePublish();
        });

        await renderIdentitySelector();
    }

    // ===== 切换身份选择器展开/收起 =====
    function toggleIdentitySelector() {
        const selector = publishModal.querySelector('.friends-publish-identity-selector');
        if (selector) {
            selector.classList.toggle('expanded');
        }
    }

    function renderPublishImages() {
        const container = document.getElementById('publish-images');
        if (!container) return;

        let html = selectedImages.map((img, idx) => `
            <div class="friends-publish-image-item">
                <img src="${img}" alt="图片${idx + 1}">
                <button class="remove-image" onclick="FriendsModule.removeImage(${idx})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        if (selectedImages.length < CONFIG.MAX_IMAGES) {
            html += `
                <div class="friends-add-image" onclick="FriendsModule.triggerImageInput()">
                    <i class="fas fa-plus"></i>
                    <span>添加图片</span>
                </div>
            `;
        }

        container.innerHTML = html;

        // 隐藏的文件输入
        if (!document.getElementById('friends-image-input')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'friends-image-input';
            input.className = 'friends-hidden-input';
            input.accept = 'image/*';
            input.multiple = true;
            input.onchange = handleImageSelect;
            document.body.appendChild(input);
        }
    }

    function triggerImageInput() {
        const input = document.getElementById('friends-image-input');
        if (input) input.click();
    }

    async function handleImageSelect(e) {
        const files = Array.from(e.target.files);
        const remaining = CONFIG.MAX_IMAGES - selectedImages.length;
        
        for (let i = 0; i < Math.min(files.length, remaining); i++) {
            const compressed = await compressImage(files[i]);
            selectedImages.push(compressed);
        }
        
        renderPublishImages();
        e.target.value = '';
    }

    function removeImage(index) {
        selectedImages.splice(index, 1);
        renderPublishImages();
    }

    async function submitPost() {
        const textarea = publishModal.querySelector('.friends-textarea');
        const content = textarea.value.trim();

        if (!content && selectedImages.length === 0) {
            showToast('请输入内容或添加图片');
            return;
        }

        // 使用当前选中的身份发布
        const currentIdentity = await getCurrentIdentity();
        const post = {
            id: generateId(),
            userId: currentIdentity.id,
            userName: currentIdentity.name,
            userAvatar: currentIdentity.avatar,
            content: content,
            images: [...selectedImages],
            likes: [],
            comments: [],
            createdAt: Date.now()
        };

        const posts = await getPosts();
        posts.unshift(post);
        await savePosts(posts);

        closePublish();
        await refreshFriends();
        showToast('发布成功');
    }

    // ===== 点赞（使用当前选中的身份）=====
    async function toggleLike(postId) {
        const currentIdentity = await getCurrentIdentity();
        const posts = await getPosts();
        const post = posts.find(p => p.id === postId);
        
        if (!post) return;

        const likeIndex = post.likes.indexOf(currentIdentity.id);
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1);
        } else {
            post.likes.push(currentIdentity.id);
        }

        await savePosts(posts);
        await refreshFriends();
    }

    // ===== 评论（使用当前选中的身份）=====
    function openCommentInput(postId, replyToId = null) {
        currentCommentPostId = postId;
        currentReplyTo = replyToId;
        
        if (!commentOverlay) createCommentOverlay();
        
        const input = commentOverlay.querySelector('.friends-comment-input');
        const replyLabel = commentOverlay.querySelector('.friends-reply-label');
        
        if (replyToId) {
            getPosts().then(async posts => {
                const p = posts.find(post => post.id === postId);
                if (p) {
                    const comment = p.comments.find(c => c.id === replyToId);
                    if (comment) {
                        const replyUser = await getUserById(comment.userId);
                        replyLabel.textContent = `回复 @${replyUser.name}`;
                        replyLabel.style.display = '';
                    }
                }
            });
        } else {
            replyLabel.style.display = 'none';
        }
        
        input.value = '';
        commentOverlay.classList.add('active');
        setTimeout(() => input.focus(), 100);
    }

    function closeCommentInput() {
        if (commentOverlay) {
            commentOverlay.classList.remove('active');
        }
        currentCommentPostId = null;
        currentReplyTo = null;
    }

    function createCommentOverlay() {
        commentOverlay = document.createElement('div');
        commentOverlay.className = 'friends-comment-input-overlay';
        commentOverlay.innerHTML = `
            <div class="friends-comment-input-bar">
                <textarea class="friends-comment-input" placeholder="评论..." rows="1"></textarea>
                <span class="friends-reply-label" style="display:none;position:absolute;top:-24px;left:16px;font-size:12px;color:var(--text-secondary);"></span>
                <button class="friends-comment-send" onclick="FriendsModule.submitComment()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        document.body.appendChild(commentOverlay);

        const input = commentOverlay.querySelector('.friends-comment-input');
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitComment();
            }
        });

        // 自动调整高度
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });

        commentOverlay.addEventListener('click', (e) => {
            if (e.target === commentOverlay) closeCommentInput();
        });
    }

    async function submitComment() {
        if (!currentCommentPostId) return;

        const input = commentOverlay.querySelector('.friends-comment-input');
        const content = input.value.trim();

        if (!content) {
            showToast('请输入评论内容');
            return;
        }

        // 使用当前选中的身份评论
        const currentIdentity = await getCurrentIdentity();
        const comment = {
            id: 'comment_' + Date.now(),
            userId: currentIdentity.id,
            userName: currentIdentity.name,
            content: content,
            replyTo: currentReplyTo,
            time: Date.now()
        };

        const posts = await getPosts();
        const post = posts.find(p => p.id === currentCommentPostId);
        
        if (post) {
            post.comments.push(comment);
            await savePosts(posts);
        }

        closeCommentInput();
        await refreshFriends();
    }

    // ===== 图片预览 =====
    function previewImage(index) {
        const postEl = event.target.closest('.friends-post');
        if (!postEl) return;

        const postId = postEl.dataset.postId;
        getPosts().then(async posts => {
            const p = posts.find(post => post.id === postId);
            if (p && p.images) {
                currentPreviewImages = p.images;
                currentPreviewIndex = index;
                showPreview();
            }
        });
    }

    function showPreview() {
        if (!previewOverlay) createPreviewOverlay();
        
        updatePreviewImage();
        previewOverlay.classList.add('active');
    }

    function closePreview() {
        if (previewOverlay) {
            previewOverlay.classList.remove('active');
        }
    }

    function createPreviewOverlay() {
        previewOverlay = document.createElement('div');
        previewOverlay.className = 'friends-preview-overlay';
        previewOverlay.innerHTML = `
            <button class="friends-preview-close" onclick="FriendsModule.closePreview()">
                <i class="fas fa-times"></i>
            </button>
            <button class="friends-preview-nav prev" onclick="FriendsModule.prevImage()">
                <i class="fas fa-chevron-left"></i>
            </button>
            <img class="friends-preview-image" id="preview-img" src="" alt="预览">
            <button class="friends-preview-nav next" onclick="FriendsModule.nextImage()">
                <i class="fas fa-chevron-right"></i>
            </button>
            <span class="friends-preview-counter" id="preview-counter"></span>
        `;

        document.body.appendChild(previewOverlay);

        previewOverlay.addEventListener('click', (e) => {
            if (e.target === previewOverlay) closePreview();
        });

        document.addEventListener('keydown', (e) => {
            if (!previewOverlay.classList.contains('active')) return;
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'Escape') closePreview();
        });
    }

    function updatePreviewImage() {
        const img = document.getElementById('preview-img');
        const counter = document.getElementById('preview-counter');
        
        if (img && currentPreviewImages[currentPreviewIndex]) {
            img.src = currentPreviewImages[currentPreviewIndex];
        }
        if (counter) {
            counter.textContent = `${currentPreviewIndex + 1} / ${currentPreviewImages.length}`;
        }

        // 隐藏导航按钮
        const prevBtn = previewOverlay.querySelector('.prev');
        const nextBtn = previewOverlay.querySelector('.next');
        if (prevBtn) prevBtn.style.opacity = currentPreviewIndex === 0 ? '0.3' : '1';
        if (nextBtn) nextBtn.style.opacity = currentPreviewIndex === currentPreviewImages.length - 1 ? '0.3' : '1';
    }

    function prevImage() {
        if (currentPreviewIndex > 0) {
            currentPreviewIndex--;
            updatePreviewImage();
        }
    }

    function nextImage() {
        if (currentPreviewIndex < currentPreviewImages.length - 1) {
            currentPreviewIndex++;
            updatePreviewImage();
        }
    }

    // ===== 更多菜单 =====
    async function showMoreMenu(event, postId) {
        event.stopPropagation();
        currentMorePostId = postId;

        if (!moreMenu) createMoreMenu();
        
        const rect = event.target.getBoundingClientRect();
        moreMenu.style.top = rect.bottom + 8 + 'px';
        moreMenu.style.right = (window.innerWidth - rect.right) + 'px';
        moreMenu.style.left = 'auto';
        
        // 检查是否是当前用户发布的（使用当前选中的身份判断）
        const posts = await getPosts();
        const p = posts.find(post => post.id === postId);
        const currentIdentity = await getCurrentIdentity();
        
        // 只有动态的发布者可以删除自己的动态
        // 使用 userId 判断是否是发布者
        const isOwner = p && p.userId === currentIdentity.id;
        moreMenu.querySelector('[data-action="delete"]').style.display = isOwner ? '' : 'none';

        moreMenu.classList.add('active');

        // 点击其他地方关闭
        setTimeout(() => {
            document.addEventListener('click', hideMoreMenu, { once: true });
        }, 10);
    }

    function hideMoreMenu() {
        if (moreMenu) {
            moreMenu.classList.remove('active');
        }
    }

    function createMoreMenu() {
        moreMenu = document.createElement('div');
        moreMenu.className = 'friends-more-menu';
        moreMenu.innerHTML = `
            <div class="friends-more-item" data-action="copy">
                <i class="fas fa-copy"></i>
                <span>复制文字</span>
            </div>
            <div class="friends-more-item" data-action="delete">
                <i class="fas fa-trash-alt"></i>
                <span>删除</span>
            </div>
        `;

        moreMenu.querySelector('[data-action="copy"]').onclick = () => {
            copyPostContent();
            hideMoreMenu();
        };

        moreMenu.querySelector('[data-action="delete"]').onclick = () => {
            hideMoreMenu();
            showDeleteConfirm();
        };

        document.body.appendChild(moreMenu);
    }

    async function copyPostContent() {
        if (!currentMorePostId) return;
        const posts = await getPosts();
        const post = posts.find(p => p.id === currentMorePostId);
        if (post) {
            navigator.clipboard.writeText(post.content).then(() => {
                showToast('已复制');
            });
        }
    }

    // ===== 删除确认 =====
    function showDeleteConfirm() {
        if (!deleteConfirm) createDeleteConfirm();
        deleteConfirm.classList.add('active');
    }

    function hideDeleteConfirm() {
        if (deleteConfirm) {
            deleteConfirm.classList.remove('active');
        }
    }

    function createDeleteConfirm() {
        deleteConfirm = document.createElement('div');
        deleteConfirm.className = 'friends-delete-confirm';
        deleteConfirm.innerHTML = `
            <div class="friends-delete-dialog">
                <h4>确认删除</h4>
                <p>删除后将无法恢复，确定要删除这条动态吗？</p>
                <div class="friends-delete-btns">
                    <button class="cancel" onclick="FriendsModule.hideDeleteConfirm()">取消</button>
                    <button class="confirm" onclick="FriendsModule.confirmDelete()">删除</button>
                </div>
            </div>
        `;

        document.body.appendChild(deleteConfirm);

        deleteConfirm.addEventListener('click', (e) => {
            if (e.target === deleteConfirm) hideDeleteConfirm();
        });
    }

    async function confirmDelete() {
        if (!currentMorePostId) return;

        const posts = await getPosts();
        const index = posts.findIndex(p => p.id === currentMorePostId);
        
        if (index > -1) {
            posts.splice(index, 1);
            await savePosts(posts);
        }

        hideDeleteConfirm();
        await refreshFriends();
        showToast('已删除');
        currentMorePostId = null;
    }

    // ===== Toast提示 =====
    function showToast(message) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'friends-toast';
            document.body.appendChild(toastEl);
        }

        toastEl.textContent = message;
        toastEl.classList.add('active');

        setTimeout(() => {
            toastEl.classList.remove('active');
        }, 2000);
    }

    // ===== 打开好友资料（预留） =====
    async function openFriendProfile(userId) {
        const user = await getUserById(userId);
        if (user.type === 'self') {
            showToast('这是你自己');
        } else {
            showToast('查看' + user.name + '的资料');
        }
    }

    // ===== 导出公共方法 =====
    window.FriendsModule = {
        open: openFriends,
        close: closeFriends,
        openPublish,
        closePublish,
        selectIdentity,
        toggleIdentitySelector,
        triggerImageInput,
        handleImageSelect,
        removeImage,
        submitPost,
        toggleLike,
        openCommentInput,
        submitComment,
        previewImage,
        closePreview,
        prevImage,
        nextImage,
        showMoreMenu,
        confirmDelete,
        hideDeleteConfirm,
        openFriendProfile,
        refresh: refreshFriends,
        getAllUsers,
        getCurrentIdentity
    };

    // ===== 添加入口到高级功能 =====
    function addEntryToAdvanced() {
        // 尝试多次查找，因为页面可能还在加载中
        let attempts = 0;
        const maxAttempts = 10;
        
        function tryAddEntry() {
            const list = document.querySelector('#advanced-modal .settings-item-list');
            
            // 检查是否已添加
            if (document.getElementById('friends-function')) {
                return true;
            }
            
            if (list) {
                const entry = document.createElement('div');
                entry.className = 'settings-item';
                entry.id = 'friends-function';
                entry.innerHTML = `
                    <i class="fas fa-globe-americas" style="color: var(--friends-accent, var(--accent-color));"></i>
                    <span>朋友圈</span>
                `;
                entry.onclick = () => {
                    hideModal(document.getElementById('advanced-modal'));
                    setTimeout(() => openFriends(), 300);
                };
                
                // 添加到列表开头
                list.insertBefore(entry, list.firstChild);
                return true;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(tryAddEntry, 200);
                return false;
            }
            
            console.warn('未找到高级功能列表，朋友圈入口添加失败');
            return false;
        }
        
        tryAddEntry();
        
        // 使用 MutationObserver 监控高级功能模态框的显示
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class') {
                        const modal = mutation.target;
                        if (modal.classList.contains('active') || modal.style.display !== 'none') {
                            // 模态框显示了，确保朋友圈入口存在
                            if (!document.getElementById('friends-function')) {
                                tryAddEntry();
                            }
                        }
                    }
                });
            });
            
            const advancedModal = document.getElementById('advanced-modal');
            if (advancedModal) {
                observer.observe(advancedModal, { attributes: true });
            }
        }
    }

    // ===== 初始化 =====
    function init() {
        // 加载CSS
        if (!document.getElementById('friends-styles')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/friends.css';
            link.id = 'friends-styles';
            document.head.appendChild(link);
        }

        // 绑定朋友圈按钮点击事件
        function bindFriendsButton() {
            const friendsBtn = document.getElementById('friends-function');
            if (friendsBtn) {
                // 移除旧的事件监听器
                friendsBtn.onclick = null;
                
                // 添加新的事件监听器
                friendsBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('朋友圈按钮被点击');
                    
                    // 关闭高级功能模态框
                    const advancedModal = document.getElementById('advanced-modal');
                    if (advancedModal) {
                        // 尝试多种方式关闭模态框
                        if (typeof hideModal === 'function') {
                            hideModal(advancedModal);
                        } else if (typeof window.hideModal === 'function') {
                            window.hideModal(advancedModal);
                        } else {
                            // 直接操作DOM
                            advancedModal.style.display = 'none';
                            advancedModal.classList.remove('active');
                        }
                    }
                    
                    // 延迟打开朋友圈
                    setTimeout(() => {
                        try {
                            openFriends();
                            console.log('朋友圈已打开');
                        } catch (err) {
                            console.error('打开朋友圈失败:', err);
                            alert('打开朋友圈失败，请刷新页面后重试');
                        }
                    }, 300);
                });
                
                console.log('朋友圈按钮事件绑定成功');
                return true;
            }
            return false;
        }

        // 等待DOM加载完成后绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // 多次尝试绑定
                let attempts = 0;
                const tryBind = setInterval(() => {
                    attempts++;
                    if (bindFriendsButton() || attempts >= 20) {
                        clearInterval(tryBind);
                        if (attempts >= 20) {
                            console.warn('朋友圈按钮绑定超时');
                        }
                    }
                }, 200);
            });
        } else {
            // DOM已加载，立即尝试绑定
            let attempts = 0;
            const tryBind = setInterval(() => {
                attempts++;
                if (bindFriendsButton() || attempts >= 20) {
                    clearInterval(tryBind);
                    if (attempts >= 20) {
                        console.warn('朋友圈按钮绑定超时');
                    }
                }
            }, 200);
        }

        console.log('朋友圈模块已加载（多角色版本）');
    }

    init();

})();
