import { tenantApi, adapterQuery } from '../../app/api.js';
import { billing, payInvoice } from '../../services/tenantBilling';

// Checkout remains owned by the existing billing service. No provider objects,
// payment signatures or AbortControllers are stored in Redux.
tenantApi.injectEndpoints({
  endpoints: build => ({
    billing: build.query({ queryFn: adapterQuery(() => billing.load()), providesTags: ['Subscription'] }),
    plans: build.query({ queryFn: adapterQuery(() => billing.plans()) }),
    quote: build.query({ queryFn: adapterQuery((args, signal) => billing.quote(args, signal)), keepUnusedDataFor: 0 }),
    changePlan: build.mutation({ queryFn: adapterQuery(args => billing.change(args)),
      invalidatesTags: (_result, error) => error ? [] : ['Subscription', 'Audit'] }),
    cancelPlan: build.mutation({ queryFn: adapterQuery(args => billing.cancel(args)),
      invalidatesTags: (_result, error) => error ? [] : ['Subscription', 'Audit'] }),
    payInvoice: build.mutation({ queryFn: adapterQuery(args => payInvoice(args)),
      invalidatesTags: (_result, error) => error ? [] : ['Subscription', 'Audit'] }),
  }),
});
