import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/Navbar';
import { CertificateTemplate, CertificateBatch } from '@/types';
import { FileText, Plus, Download, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export const Dashboard = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [recentBatches, setRecentBatches] = useState<CertificateBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('certificate_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (templatesError) throw templatesError;

      // Fetch recent batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('certificate_batches')
        .select(`
          *,
          template:certificate_templates(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (batchesError) throw batchesError;

      setTemplates(templatesData || []);
      setRecentBatches(batchesData || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your certificate templates and track generation progress
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Create Template</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Design new certificate templates
              </p>
              <Button asChild size="sm" className="w-full">
                <Link to="/templates">Create Template</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Generate Certificates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Create certificates in bulk
              </p>
              <Button asChild size="sm" className="w-full">
                <Link to="/generate">Generate Now</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">View History</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                Track all generated batches
              </p>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/history">View History</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Templates</span>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/templates">View All</Link>
                </Button>
              </CardTitle>
              <CardDescription>
                Your recently created certificate templates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates created yet</p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/templates">Create Your First Template</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {template.description || 'No description'}
                        </p>
                        <div className="flex items-center mt-2 space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {template.template_type.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {template.placeholders.length} placeholders
                          </span>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/templates/${template.id}`}>Edit</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Batches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Generations</span>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/history">View All</Link>
                </Button>
              </CardTitle>
              <CardDescription>
                Your recently generated certificate batches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No certificates generated yet</p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/generate">Generate Your First Batch</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {getStatusIcon(batch.status)}
                          <h4 className="font-medium">{batch.batch_name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Template: {batch.template?.name || 'Unknown'}
                        </p>
                        <div className="flex items-center mt-2 space-x-2">
                          <Badge className={getStatusColor(batch.status)}>
                            {batch.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {batch.generated_certificates}/{batch.total_certificates} generated
                          </span>
                        </div>
                      </div>
                      {batch.status === 'completed' && (
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};