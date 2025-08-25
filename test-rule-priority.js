// Test rule prioritization logic
const rules = [
  {
    id: 'rule1',
    name: 'Inventory < 15 → +100',
    trigger: {
      inventory: { lte: 15 }
    },
    action: { price: { adjust: 100 } }
  },
  {
    id: 'rule2', 
    name: 'Inventory < 10 → +100',
    trigger: {
      inventory: { lte: 10 }
    },
    action: { price: { adjust: 100 } }
  }
];

// Simulate current inventory 
const inventory = 8;

// Check which rules match
const applicableRules = rules.filter(rule => {
  if (rule.trigger.inventory?.lte !== undefined) {
    return inventory <= rule.trigger.inventory.lte;
  }
  return false;
});

console.log('📊 Test Scenario: Inventory =', inventory);
console.log('📋 All Rules:', rules.map(r => r.name));
console.log('✅ Applicable Rules:', applicableRules.map(r => r.name));

// Prioritization logic (more specific = lower threshold value = higher priority)
function prioritizeRules(rules) {
  return [...rules].sort((a, b) => {
    // Lower inventory threshold = more specific = higher priority
    if (a.trigger.inventory?.lte !== undefined && b.trigger.inventory?.lte !== undefined) {
      return a.trigger.inventory.lte - b.trigger.inventory.lte;
    }
    return 0;
  });
}

const prioritizedRules = prioritizeRules(applicableRules);
const selectedRule = prioritizedRules[0];

console.log('🎯 Rule Priority Order:', prioritizedRules.map(r => `${r.name} (threshold: ${r.trigger.inventory.lte})`));
console.log('⭐ Selected Rule:', selectedRule ? selectedRule.name : 'None');
console.log('💰 Price Adjustment:', selectedRule ? selectedRule.action.price.adjust : 'None');

// Test with different inventory levels
console.log('\n🧪 Additional Test Cases:');
[5, 8, 12, 18].forEach(testInventory => {
  const testApplicable = rules.filter(rule => {
    if (rule.trigger.inventory?.lte !== undefined) {
      return testInventory <= rule.trigger.inventory.lte;
    }
    return false;
  });
  
  const testPrioritized = prioritizeRules(testApplicable);
  const testSelected = testPrioritized[0];
  
  console.log(`Inventory ${testInventory}: ${testSelected ? testSelected.name : 'No rules match'}`);
});
