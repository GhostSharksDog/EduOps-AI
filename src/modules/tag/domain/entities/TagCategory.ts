import {Feature} from "@/shared/types/feature";

/**
 * 标签分类实体类
 * 对应 Schema: src/shared/schemas/response/tag-category.ts::tagCategorySchema
 */
export class TagCategory {
    constructor(
        public id: string,
        public name: string,
        public path: string,
        public orderIndex: number,
        public ownedBy: string,
        public createTime: Date,
        public createdBy: string,
        public tagCount: number = 0,
        public feature?: Feature,
        public parentId?: string,
        public parent?: TagCategory,
        public description?: string,
        public children: TagCategory[] = [],
        public isDeleted: boolean = false,
        public updateTime?: Date,
        public deleteTime?: Date,
        public updatedBy?: string,
        public deletedBy?: string
    ) {
    }

    public updateInfo(name: string, description?: string, orderIndex?: number): void {
        this.name = name;
        if (description !== undefined) {
            this.description = description;
        }
        if (orderIndex !== undefined) {
            this.orderIndex = orderIndex;
        }
        this.updateTime = new Date();
    }

    public moveTo(parentId: string | undefined, newPath: string): void {
        this.parentId = parentId;
        this.path = newPath;
        this.updateTime = new Date();
    }

    public addChild(child: TagCategory): void {
        this.children.push(child);
        this.updateTime = new Date();
    }

    public removeChild(childId: string): void {
        this.children = this.children.filter(c => c.id !== childId);
        this.updateTime = new Date();
    }

    public incrementTagCount(count: number = 1): void {
        this.tagCount += count;
        this.updateTime = new Date();
    }

    public decrementTagCount(count: number = 1): void {
        this.tagCount = Math.max(0, this.tagCount - count);
        this.updateTime = new Date();
    }

    public updateFeature(feature: Feature): void {
        this.feature = feature;
        this.updateTime = new Date();
    }
}
