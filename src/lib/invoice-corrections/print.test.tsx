import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BillingDocument, BillingPrintStyles } from "@/components/invoices/BillingDocument";
import type { BillingDocumentData } from "./documents";

test("credit print page box uses the existing invoice URL-header suppression mechanism",()=>{
 const reference=readFileSync("src/app/public/invoice/[token]/page.tsx","utf8");
 const css=renderToStaticMarkup(createElement(BillingPrintStyles));
 for(const value of [reference,css]){
  const page=value.match(/@page\s*\{([^}]+)\}/)?.[1];assert.ok(page);
  assert.match(page,/margin:\s*0\s*;/);assert.match(page,/size:\s*A4\s*;/);
 }
 assert.match(css,/\.billing-document-page\s*\{[^}]*padding:0!important/);
 assert.match(css,/\.billing-document\s*\{[^}]*padding:\.5in!important/);
 assert.match(css,/\.no-print,\.print-hide\s*\{\s*display:none!important/);
 assert.match(css,/thead\s*\{\s*display:table-header-group/);
 assert.match(css,/tr\s*\{\s*break-inside:avoid/);
 assert.match(css,/\.billing-document \+ \.billing-document\s*\{\s*break-before:page/);
});

test("print chrome suppression retains customer document identity, amounts and configured footer",()=>{
 const document:BillingDocumentData={title:"CREDIT NOTE",number:"CN-SYN-1",date:"2026-10-27",status:"Issued",supplier:{businessName:"Synthetic Studio",abn:"12345678901",address:"Test address",email:"studio@example.test"},customer:{name:"Synthetic Client",email:"customer@example.test",abn:"",address:[]},lines:[{jobTitle:"Development",title:"Service",unit:"day",quantity:1,unitPriceMinor:100000,gstApplicable:false,subtotalMinor:100000,taxMinor:0,totalMinor:100000}],subtotalMinor:100000,taxMinor:0,totalMinor:100000,reference:"Applies to SYN-1",notes:"Correct omitted GST",footer:"Configured invoice footer"};
 const html=renderToStaticMarkup(createElement(BillingDocument,{document}));
 for(const text of ["CREDIT NOTE","CN-SYN-1","12345678901","Synthetic Client","$1,000.00","Applies to SYN-1","Correct omitted GST","Configured invoice footer"])assert.ok(html.includes(text),text);
 const css=renderToStaticMarkup(createElement(BillingPrintStyles));
 assert.ok(!/\.footer-section\s*\{\s*display:none/.test(css));
});
