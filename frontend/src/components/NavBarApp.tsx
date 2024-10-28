import React, { useEffect, useState } from 'react';
import { getUnsolvedTicketsFromCache, debugLog, errorLog } from '../services/apiService';
import { getSubdomain } from '../utils';
import { TicketData, ZendeskTicketStatus } from '../types';
import { format } from 'date-fns';

type SortField = 'sentiment' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

interface NavBarAppProps {
  zafClient: any;
  originalQueryString: string;
  selectedRange?: 'negative' | 'neutral' | 'positive';
}

const getSortValue = (ticket: TicketData, field: SortField): number => {
  switch (field) {
    case 'sentiment':
      return ticket.score || 0;
    case 'created_at':
      return new Date(ticket.created_at).getTime();
    case 'updated_at':
      return new Date(ticket.updated_at).getTime();
    default:
      return 0;
  }
};

const NavBarContent: React.FC<NavBarAppProps> = ({ zafClient, originalQueryString, selectedRange }) => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<SortField>('sentiment');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [subdomain, setSubdomain] = useState<string>('');
  const [medianSentiment, setMedianSentiment] = useState<number>(0);
  const [stdDeviation, setStdDeviation] = useState<number>(0);
  const TICKETS_PER_PAGE = 25;

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setIsLoading(true);
        // Get unsolved tickets from cache
        const response = await getUnsolvedTicketsFromCache(zafClient);
        let filteredTickets = response.results;

        // Apply range filter if selected
        if (selectedRange) {
          filteredTickets = filteredTickets.filter(ticket => {
            const score = ticket.score || 0;
            switch (selectedRange) {
              case 'negative': return score <= -0.5;
              case 'neutral': return score > -0.5 && score < 0.5;
              case 'positive': return score >= 0.5;
              default: return true;
            }
          });
        }

        // Calculate median and standard deviation
        if (filteredTickets.length > 0) {
          const scores = filteredTickets.map(t => t.score || 0);
          const sortedScores = [...scores].sort((a, b) => a - b);
          const mid = Math.floor(sortedScores.length / 2);
          setMedianSentiment(sortedScores.length % 2 ? sortedScores[mid] : (sortedScores[mid - 1] + sortedScores[mid]) / 2);
          
          const mean = scores.reduce((a, b) => a + b) / scores.length;
          const squareDiffs = scores.map(score => Math.pow(score - mean, 2));
          const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
          setStdDeviation(Math.sqrt(avgSquareDiff));
        }

        // Sort tickets using the helper function
        const sortedTickets = [...filteredTickets].sort((a, b) => {
          const aValue = getSortValue(a, sortField);
          const bValue = getSortValue(b, sortField);
          return sortDirection === 'asc' ? 
            (aValue > bValue ? 1 : -1) : 
            (aValue < bValue ? 1 : -1);
        });

        // Paginate
        const startIndex = (currentPage - 1) * TICKETS_PER_PAGE;
        const paginatedTickets = sortedTickets.slice(startIndex, startIndex + TICKETS_PER_PAGE);
        setTotalPages(Math.ceil(sortedTickets.length / TICKETS_PER_PAGE));

        // Get additional ticket details from Zendesk API
        const ticketsWithDetails = await Promise.all(paginatedTickets.map(async (ticket) => {
          try {
            const details = await zafClient.request({
              url: `/api/v2/tickets/${ticket.id}.json`,
              type: 'GET'
            });
            return {
              ...ticket,
              requestor: details.ticket.requester,
              assignee: details.ticket.assignee
            };
          } catch (error) {
            errorLog(`Error fetching details for ticket ${ticket.id}:`, error);
            return ticket;
          }
        }));

        setTickets(ticketsWithDetails);
        setIsLoading(false);
      } catch (error) {
        errorLog('Error fetching tickets:', error);
        setError('Failed to load tickets');
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [zafClient, currentPage, sortField, sortDirection, selectedRange]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSentimentColor = (score: number) => {
    if (score <= -0.5) return '#ffcccc';
    if (score >= 0.5) return '#ccffcc';
    return '#ffffcc';
  };

  return (
    <div className="navbar">
      <div className="sentiment-bar">
        <div className="gradient-bar">
          <div 
            className="median-line" 
            style={{ left: `${((medianSentiment + 1) / 2) * 100}%` }}
          />
          <div 
            className="std-dev-box"
            style={{
              left: `${((medianSentiment - stdDeviation + 1) / 2) * 100}%`,
              width: `${(stdDeviation / 2) * 100}%`
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading tickets...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <table className="ticket-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('sentiment')}>
                  Sentiment {sortField === 'sentiment' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Requestor</th>
                <th>Assignee</th>
                <th onClick={() => handleSort('created_at')}>
                  Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('updated_at')}>
                  Updated {sortField === 'updated_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id} onClick={() => zafClient.invoke('routeTo', 'ticket', ticket.id)}>
                  <td>
                    <div 
                      className="sentiment-box"
                      style={{ backgroundColor: getSentimentColor(ticket.score || 0) }}
                    >
                      {(ticket.score || 0).toFixed(2)}
                    </div>
                  </td>
                  <td>{ticket.requestor?.name || 'Unassigned'}</td>
                  <td>{ticket.assignee?.name || 'Unassigned'}</td>
                  <td>{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</td>
                  <td>{format(new Date(ticket.updated_at), 'MMM d, yyyy HH:mm')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default NavBarContent;
