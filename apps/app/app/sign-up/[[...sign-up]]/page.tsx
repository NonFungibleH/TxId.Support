import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            // Hide the Web3/wallet sign-up option — require email or GitHub only
            web3WalletConnectButton: { display: "none" },
            web3WalletSectionHeader: { display: "none" },
            web3Wallet: { display: "none" },
          },
        }}
      />
    </div>
  );
}
