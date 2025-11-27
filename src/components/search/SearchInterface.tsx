import React, { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Star, Clock, Award } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SME, SearchFilters } from '../../types';

interface SearchInterfaceProps {
  smes: SME[];
  onSMESelect: (sme: SME) => void;
}

export function SearchInterface({ smes, onSMESelect }: SearchInterfaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [filteredSMEs, setFilteredSMEs] = useState<SME[]>(smes);
  const [showFilters, setShowFilters] = useState(false);

  const roles = ['Facilitator', 'Assessor', 'Moderator', 'Consultant'];
  const sectors = ['Manufacturing', 'Services', 'Mining', 'Healthcare', 'Education', 'Technology', 'Finance'];
  const locations = ['Johannesburg, Gauteng', 'Cape Town, Western Cape', 'Durban, KwaZulu-Natal', 'Pretoria, Gauteng'];
  const availabilityOptions = ['Available', 'Busy', 'Offline', 'Away'];

  useEffect(() => {
    let filtered = smes.filter(sme => {
      const matchesSearch = !searchTerm || 
        sme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sme.specializations.some(spec => spec.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (sme.roles || (sme.role ? [sme.role] : [])).some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRole = !filters.role || (sme.roles || (sme.role ? [sme.role] : [])).some(r => r.toLowerCase().includes(filters.role!.toLowerCase()));
      const matchesSector = !filters.sector || sme.sectors.includes(filters.sector);
      const matchesLocation = !filters.location || sme.location === filters.location;
      const matchesAvailability = !filters.availability || sme.availability === filters.availability;
      const matchesSpecialization = !filters.specialization || 
        sme.specializations.some(spec => spec.toLowerCase().includes(filters.specialization!.toLowerCase()));
      
      return matchesSearch && matchesRole && matchesSector && matchesLocation && 
             matchesAvailability && matchesSpecialization;
    });
    
    setFilteredSMEs(filtered);
  }, [searchTerm, filters, smes]);

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  const SMECard = ({ sme }: { sme: SME }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
         onClick={() => onSMESelect(sme)}>
      <div className="flex items-start space-x-4">
        <img
          src={sme.profileImage}
          alt={sme.name}
          className="w-16 h-16 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{sme.name}</h3>
            {sme.verified && (
              <Badge variant="success" size="sm">
                <Award className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
          
          <p className="text-gray-600 mb-2">{(sme.roles || (sme.role ? [sme.role] : [])).join(', ')}</p>
          
          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>{sme.location}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <span>
                {((sme.reviews && sme.reviews > 0) && sme.rating && sme.rating > 0) ? sme.rating.toFixed(1) : '0.0'} 
                ({sme.reviews || 0} {sme.reviews === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span className={`font-medium ${
                sme.availability === 'Available' ? 'text-green-600' :
                sme.availability === 'Busy' ? 'text-yellow-600' : 
                sme.availability === 'Offline' ? 'text-gray-600' : 'text-orange-600'
              }`}>
                {sme.availability}
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {sme.specializations.slice(0, 3).map((spec, index) => (
              <Badge key={index} variant="info" size="sm">{spec}</Badge>
            ))}
            {sme.specializations.length > 3 && (
              <Badge variant="default" size="sm">+{sme.specializations.length - 3} more</Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Standard Engagement: R2,500</span>
            </div>
            <Button size="sm">View Profile</Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search SMEs by name, specialization, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-6 p-6 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={filters.role || ''}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Roles</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sector</label>
                <select
                  value={filters.sector || ''}
                  onChange={(e) => setFilters({ ...filters, sector: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Sectors</option>
                  {sectors.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select
                  value={filters.location || ''}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Locations</option>
                  {locations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={filters.availability || ''}
                  onChange={(e) => setFilters({ ...filters, availability: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  {availabilityOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Subject Matter Experts
        </h2>
        <p className="text-gray-600">
          {filteredSMEs.length} SME{filteredSMEs.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {filteredSMEs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No SMEs found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search criteria or filters</p>
          <Button onClick={clearFilters}>Clear all filters</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSMEs.map(sme => (
            <SMECard key={sme.id} sme={sme} />
          ))}
        </div>
      )}
    </div>
  );
}