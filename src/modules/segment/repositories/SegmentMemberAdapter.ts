import {SegmentMember} from '@/modules/segment/domain/entities/SegmentMember';
import {SegmentMemberPO} from '@/modules/segment/repositories/persistence/SegmentMemberPO';

export interface SegmentMemberAdapter {
    fromPOToSegmentMemberDomain(memberPO: SegmentMemberPO): SegmentMember;

    fromSegmentMemberDomainToPO(member: SegmentMember): SegmentMemberPO;
}
