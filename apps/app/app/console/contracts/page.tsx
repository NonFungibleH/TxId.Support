import ContractsPage from "@/app/dashboard/contracts/page"

export const dynamic = "force-dynamic"

/**
 * The SAME contracts page, rendered inside the Console shell.
 *
 * Watched contracts are project-level configuration shared by every product, so
 * a customer with Support and Console must not declare them twice, and the two
 * lists must not be able to disagree. Re-exporting rather than reimplementing
 * is what guarantees that.
 */
export default ContractsPage
