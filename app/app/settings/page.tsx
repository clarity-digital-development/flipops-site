"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Clock,
  Globe,
  Mail,
  Rocket,
  Save,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Settings,
  Shield,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Settings {
  timezone: string;
  currency: string;
  emailAlerts: boolean;
  dailyDigest: boolean;
  digestTime: string | null;
  emailSignatureEnabled: boolean;
  emailSenderName: string | null;
  emailCompanyName: string | null;
  emailSignature: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Settings → Integrations: live Nylas email connect/disconnect control.
// Backed by GET /api/email/status, POST /api/email/connect (returns authUrl),
// POST /api/email/disconnect.
function EmailIntegrationCard() {
  const { data, isLoading, mutate } = useSWR<{ connected: boolean; email?: string }>(
    "/api/email/status",
    fetcher,
  );
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/email/connect");
      const json = await res.json();
      if (res.ok && json.authUrl) {
        window.location.href = json.authUrl;
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await fetch("/api/email/disconnect", { method: "POST" });
      await mutate();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-48" />;
  }

  if (data?.connected) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="secondary">Connected{data.email ? `: ${data.email}` : ""}</Badge>
        <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={handleConnect} disabled={busy}>
      Connect Email
    </Button>
  );
}

export default function SettingsPage() {
  const { data: settings, error, isLoading, mutate } = useSWR<Settings>("/api/settings", fetcher);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local state for form fields
  const [formData, setFormData] = useState<Partial<Settings>>({});

  // Sync form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = <K extends keyof Settings>(field: K, value: Settings[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toast = (props: { title: string; description: string; variant?: "default" | "destructive" }) => {
    if (typeof window !== "undefined") {
      const notification = document.createElement("div");
      notification.className = `fixed bottom-4 right-4 z-50 p-4 ${
        props.variant === "destructive" ? "bg-red-500" : "bg-green-500"
      } text-white rounded-lg shadow-lg transition-all`;
      notification.innerHTML = `<div class="font-semibold">${props.title}</div><div class="text-sm">${props.description}</div>`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.style.opacity = "0";
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save");

      await mutate();
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-destructive">Failed to load settings</p>
          <Button variant="outline" className="mt-4" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account preferences and notifications
            </p>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

        <Tabs defaultValue="preferences" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-fit flex-shrink-0">
            <TabsTrigger value="preferences" className="gap-2">
              <Settings className="h-4 w-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Rocket className="h-4 w-4" />
              Integrations
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            {/* Preferences - Consolidated Tab */}
            <TabsContent value="preferences" className="h-full mt-0">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8 pr-4">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Notifications */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">Notifications</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-14 w-full" />
                          <Skeleton className="h-14 w-full" />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <Label className="text-sm">Email Alerts</Label>
                                <p className="text-xs text-muted-foreground">
                                  Important updates via email
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={formData.emailAlerts ?? true}
                              onCheckedChange={(checked) => updateField("emailAlerts", checked)}
                            />
                          </div>

                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <Label className="text-sm">Daily Digest</Label>
                                <p className="text-xs text-muted-foreground">
                                  Summary of leads and activity
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={formData.dailyDigest ?? true}
                              onCheckedChange={(checked) => updateField("dailyDigest", checked)}
                            />
                          </div>

                          {formData.dailyDigest && (
                            <div className="space-y-2 pl-3 border-l-2 border-muted ml-2">
                              <Label className="text-sm">Digest Time</Label>
                              <Select
                                value={formData.digestTime || "08:00"}
                                onValueChange={(value) => updateField("digestTime", value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="06:00">6:00 AM</SelectItem>
                                  <SelectItem value="07:00">7:00 AM</SelectItem>
                                  <SelectItem value="08:00">8:00 AM</SelectItem>
                                  <SelectItem value="09:00">9:00 AM</SelectItem>
                                  <SelectItem value="12:00">12:00 PM</SelectItem>
                                  <SelectItem value="17:00">5:00 PM</SelectItem>
                                  <SelectItem value="18:00">6:00 PM</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Account & Security */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">Account & Security</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Security settings are managed through Clerk.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open("https://accounts.clerk.dev/user", "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Manage Security
                        </Button>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 text-destructive mb-3">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Danger Zone</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Account
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account
                                and remove all of your data from our servers, including:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>All leads and properties</li>
                                  <li>Contracts and offers</li>
                                  <li>Vendor relationships</li>
                                  <li>Campaign history</li>
                                </ul>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                  toast({
                                    title: "Not Available",
                                    description: "Account deletion is not available during beta. Contact support for assistance.",
                                    variant: "destructive",
                                  });
                                }}
                              >
                                Delete Account
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <p className="text-xs text-muted-foreground mt-2">
                          Disabled during beta
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Regional Settings */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">Regional Settings</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isLoading ? (
                        <div className="space-y-4">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Timezone</Label>
                            <Select
                              value={formData.timezone || "America/New_York"}
                              onValueChange={(value) => updateField("timezone", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                                <SelectItem value="America/Phoenix">Arizona Time (AZ)</SelectItem>
                                <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                                <SelectItem value="America/Anchorage">Alaska Time (AK)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Currency</Label>
                            <Select
                              value={formData.currency || "USD"}
                              onValueChange={(value) => updateField("currency", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">$ USD - US Dollar</SelectItem>
                                <SelectItem value="CAD">$ CAD - Canadian Dollar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Email Signature */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-base">Email Signature</CardTitle>
                        </div>
                        {!isLoading && (
                          <Switch
                            checked={formData.emailSignatureEnabled ?? false}
                            onCheckedChange={(checked) => updateField("emailSignatureEnabled", checked)}
                          />
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        Appended to outbound emails
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label className="text-sm">Sender Name</Label>
                            <Input
                              value={formData.emailSenderName || ""}
                              onChange={(e) => updateField("emailSenderName", e.target.value)}
                              placeholder="John Smith"
                              disabled={!formData.emailSignatureEnabled}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm">Company Name</Label>
                            <Input
                              value={formData.emailCompanyName || ""}
                              onChange={(e) => updateField("emailCompanyName", e.target.value)}
                              placeholder="Smith Real Estate Investments"
                              disabled={!formData.emailSignatureEnabled}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm">Signature</Label>
                            <Textarea
                              value={formData.emailSignature || ""}
                              onChange={(e) => updateField("emailSignature", e.target.value)}
                              placeholder={"Best regards,\nJohn Smith\nSmith Real Estate\n(555) 123-4567"}
                              rows={4}
                              disabled={!formData.emailSignatureEnabled}
                            />
                          </div>

                          {formData.emailSignatureEnabled &&
                            (formData.emailSenderName || formData.emailCompanyName || formData.emailSignature) && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs font-medium mb-2 text-muted-foreground">Preview:</p>
                                <div className="text-sm whitespace-pre-line border-t border-muted pt-2">
                                  {formData.emailSignature || (
                                    <>
                                      {formData.emailSenderName && <div>{formData.emailSenderName}</div>}
                                      {formData.emailCompanyName && (
                                        <div className="font-medium">{formData.emailCompanyName}</div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              </ScrollArea>
            </TabsContent>

            {/* Integrations — live Nylas email connect card */}
            <TabsContent value="integrations" className="h-full mt-0">
              <ScrollArea className="h-full">
              <div className="p-6 max-w-3xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Email (Nylas)</CardTitle>
                    <CardDescription>
                      Connect your inbox to send offers, follow-ups, and disposition blasts
                      from FlipOps. Read receipts and reply tracking land back in /app/inbox.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmailIntegrationCard />
                  </CardContent>
                </Card>
              </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
    </div>
  );
}
