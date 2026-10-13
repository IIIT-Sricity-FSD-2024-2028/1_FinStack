import { moneyValue } from './policyConfiguration.js'

export function existingTemplate(records, template) {
  return records.find(record => record.templateKey === template.key || String(record.name).trim().toLowerCase() === template.name.toLowerCase())
}

export function applicableCategory(categories, template, catalog) {
  const definition = catalog.categories.find(item => item.key === template.categoryKey)
  return categories.find(category => category.status === 'Active' && (category.templateKey === template.categoryKey || (!category.templateKey && category.name.trim().toLowerCase() === definition?.name.toLowerCase())))
}

export function validPolicySelection(value) {
  return value && moneyValue(value.maxAmount) !== null && /^[A-Z]{3}$/.test(value.currency) && [0, 1, 2].includes(Number(value.approvalLevels)) && typeof value.receiptRequired === 'boolean'
}
