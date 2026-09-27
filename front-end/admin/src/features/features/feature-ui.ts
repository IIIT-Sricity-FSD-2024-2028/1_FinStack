import { FeatureValueType } from '../../types/catalog';

export const formatValueType = (type: FeatureValueType) => {
  switch (type) {
    case 'BOOLEAN':
      return 'Boolean (True/False)';
    case 'INTEGER':
      return 'Integer Number';
    case 'DECIMAL':
      return 'Decimal Number';
    case 'STRING':
      return 'Text (String)';
    case 'JSON':
      return 'JSON Object/Array';
    default:
      return type;
  }
};
