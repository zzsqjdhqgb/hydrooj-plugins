import { Context } from 'hydrooj';

export async function apply(ctx: Context) {
    // 在 UserDetail 处理器完成后添加博客数据
    ctx.on('handler/after/UserDetail#get', async (h) => {
        const uid = h.args.uid;

        try {
            // 检查博客模型是否可用
            if (!global.Hydro?.model?.blog) {
                console.debug('Blog model not available, skipping blog data loading');
                h.response.body.blog_info = {
                    ddocs: [],
                    available: false
                };
                return;
            }

            const BlogModel = global.Hydro.model.blog;
            
            // In hydrooj v4.19, h.ctx.db.paginate is unavailable, 
            // we need to import paginate
            // 动态选择 paginate 函数
            let paginateFunc;
            if (h.ctx?.db?.paginate) {
                // 新版本
                paginateFunc = h.ctx.db.paginate;
            } else {
                // 老版本：尝试通过 require 获取
                try {
                    const hydrooj = require('hydrooj');
                    paginateFunc = hydrooj.paginate;
                } catch (e) {
                    console.warn('Failed to require paginate from hydrooj:', e.message);
                    throw new Error('No paginate function available');
                }
            }

            // 获取博客数据
            const [ddocs, ] = await paginateFunc(
                BlogModel.getMulti({ owner: parseInt(uid) }),
                1,  // 第一页
                10, // 每页10篇
            );

            const [, blogcnt] = await paginateFunc(
                BlogModel.getMulti({ owner: parseInt(uid) }),
                1,  // 第一页
                1, // 每页1篇用于获取总数
            );

            const blog_info = {
                ddocs,
                totalPosts: blogcnt,
                available: true
            };

            // 将博客数据添加到响应中
            h.response.body.blog_info = blog_info;

        } catch (error) {
            // 记录错误但不影响原有功能
            console.warn(`Failed to load blog posts for user ${uid}:`, error.message);
            h.response.body.blog_info = {
                ddocs: [],
                totalPosts: 0,
                available: true,
                error: true
            };
        }
    });

    // 国际化配置
    ctx.i18n.load('zh', {
        'Recent Blogs': '最近的博客',
        'Failed to load blog data, please try again later': '加载博客数据失败，请稍后重试',
        'Blog feature is not available': '博客功能暂不可用',
        '{0} views': '{0} 次查看',
        'View All Blogs {0}': '查看全部博客 ({0})',
        'This user hasn\'t published any blog posts yet': '该用户还没有发布任何博客文章',
        'Create Your First Post': '发布第一篇文章',
    });

    ctx.i18n.load('en', {
        'Recent Blogs': 'Recent Blogs',
        'Failed to load blog data, please try again later': 'Failed to load blog data, please try again later',
        'Blog feature is not available': 'Blog feature is not available',
        '{0} views': '{0} views',
        'View All Blogs {0}': 'View All Blogs ({0})',
        'This user hasn\'t published any blog posts yet': 'This user hasn\'t published any blog posts yet',
        'Create Your First Post': 'Create Your First Post',
    });
}