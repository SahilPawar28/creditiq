import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile } = useAuth();
  const [dark, setDark] = useState(false);
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
    else if (user?.displayName) setName(user.displayName);
  }, [profile, user]);

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  const saveProfile = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    setSavingProfile(true);
    try {
      await Promise.all([
        updateProfile(user, { displayName: name }),
        updateDoc(doc(db, "users", user.uid), { name }),
      ]);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!user || !user.email) return;
    if (!currentPwd || !newPwd) { toast.error("All password fields are required"); return; }
    if (newPwd.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPwd !== confirmPwd) { toast.error("Passwords do not match"); return; }

    setSavingPwd(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPwd);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      toast.success("Password changed successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile and preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">Full Name</Label>
              <Input
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                value={user?.email ?? ""}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile?.role ?? "user"} disabled className="opacity-60 capitalize" />
            </div>
            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              {savingProfile ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
            <CardDescription>Requires your current password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-cur">Current password</Label>
              <Input
                id="s-cur"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-new">New password</Label>
              <Input
                id="s-new"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-conf">Confirm new password</Label>
              <Input
                id="s-conf"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button onClick={changePassword} disabled={savingPwd} variant="outline">
              {savingPwd ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</> : "Update password"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Switch between light and dark mode</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dark mode</p>
                <p className="text-sm text-muted-foreground">Easier on the eyes in low light.</p>
              </div>
              <Switch checked={dark} onCheckedChange={setDark} />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
