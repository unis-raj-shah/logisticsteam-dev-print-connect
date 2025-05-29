import singleChuteStrategy from '@/models/sorting-strategy/singleChuteStrategy';
import defaultStrategy from '@/models/sorting-strategy/defaultStrategy';
import balanceChuteStrategy from '@/models/sorting-strategy/balanceChuteStrategy';
import parentChuteStrategy from '@/models/sorting-strategy/parentChuteStrategy';
import manualChuteStrategy from '@/models/sorting-strategy/manualChuteStrategy';

const obj: { [key: string]: any } = {
    singleChuteStrategy,
    balanceChuteStrategy,
    parentChuteStrategy,
    manualChuteStrategy,
    defaultStrategy,
};

export default obj;
