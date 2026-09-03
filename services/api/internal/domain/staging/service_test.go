package staging

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseCSVAmount(t *testing.T) {
	assert.Equal(t, int64(15000), parseCSVAmount("$150.00"))
	assert.Equal(t, int64(-4550), parseCSVAmount("-$45.50"))
	assert.Equal(t, int64(250050), parseCSVAmount("2,500.50"))
	assert.Equal(t, int64(0), parseCSVAmount("invalid"))
}

func TestParseCSVDate(t *testing.T) {
	assert.Equal(t, "2026-09-03", parseCSVDate("2026-09-03"))
	assert.Equal(t, "2026-09-03", parseCSVDate("09/03/2026"))
}

func TestMatchAccountRule(t *testing.T) {
	rules := []AccountRule{
		{ID: "acc-5020", AccountCode: "5020", Name: "Cloud Infrastructure", Keywords: []string{"cloud", "infrastructure"}},
		{ID: "acc-4010", AccountCode: "4010", Name: "SaaS Revenue", Keywords: []string{"saas", "revenue"}},
	}

	// High confidence match for AWS
	id, conf := matchAccountRule("AWS Cloud Infrastructure Invoice", rules)
	assert.Equal(t, "acc-5020", id)
	assert.Equal(t, 0.90, conf)

	// High confidence match for Stripe
	id, conf = matchAccountRule("Stripe Monthly Payout", rules)
	assert.Equal(t, "acc-4010", id)
	assert.Equal(t, 0.90, conf)

	// No match
	id, conf = matchAccountRule("Unknown Vendor Payment", rules)
	assert.Equal(t, "", id)
	assert.Equal(t, 0.0, conf)
}
