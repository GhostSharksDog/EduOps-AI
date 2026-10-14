import {TagVersion} from '@/modules/tag/domain/entities/index';
import {type PaginationQueryDTO} from '@/shared/schemas/common/index';
import {type UpdateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import {TagStatus} from '@/shared/enums/tag/TagStatus';

/**
 * 标签版本领域服务接口
 */
export interface TagVersionDomainService {
    /**
     * 获取版本
     * @param versionId 版本ID
     */
    getVersion(versionId: string): Promise<TagVersion>;

    /**
     * 更新版本
     * @param versionId 版本ID
     * @param versionData 版本更新数据
     */
    updateVersion(versionId: string, versionData: UpdateTagVersionDTO): Promise<TagVersion>;

    /**
     * 更新版本状态
     * @param versionId 版本ID
     * @param status 目标状态
     */
    updateVersionStatus(versionId: string, status: TagStatus): Promise<TagVersion>;

    /**
     * 列出版本
     * @param tagId 标签ID
     * @param pagination 分页查询参数
     */
    listVersions(tagId: string, pagination?: PaginationQueryDTO): Promise<TagVersion[]>;

    /**
     * 统计版本数量
     * @param tagId 标签ID
     */
    countVersionsByTagId(tagId: string): Promise<number>;

    /**
     * 获取当前版本
     * @param tagId 标签ID
     */
    getCurrentVersion(tagId: string): Promise<TagVersion>;
}
