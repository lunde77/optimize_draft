using CSV
using DataFrames
using JuMP
using Cbc
using XLSX

# Load the Excel file
xlsx = XLSX.readxlsx(raw"C:\Users\Gustav\Documents\ff\2026\projections.xlsx")
QB = xlsx["QBs"][:,2:3]
RB = xlsx["RBs"][:,2:3]
WR = xlsx["WRs"][:,2:3]
TE = xlsx["TEs"][:,2:3]


# define standart parameters
startere = [2, 3, 3, 2, 7] # starters at eeach spot, qb, rb, wr, te, flex
position_target = startere

R = 13 # number of round
P = 4 # positions



# define which players are expected to be available at specefic rounds:

# both don't have a correct projection for last two rounds
rund_valg_fp = [
[2, 8, 10, 16, 17, 20, 21, 24, 25, 25, 25], # QB
[1, 5, 5, 8, 9, 13, 14,  18, 20, 24, 27],   # RB
[1, 4, 6, 9, 11, 14, 16, 21, 23, 29, 30],   # WR
[1, 1, 1, 1, 2, 4, 4,    4, 4, 5, 5]        # TE
]


# maybe see if we have the actual number of players taken at the spots:
# last three round were original expectations
own_projection_2 = [
[2, 6, 6,  9,   10,  11, 12, 16, 16,   18, 20, 21, 21 ],  # QB
[1, 8, 10, 12,  14,  19, 20, 21, 22,   22, 25, 28, 31 ],  # RB
[1, 3, 4,  9,   9,  16, 16,  23, 26,   28, 29, 35, 36 ],    # WR
[1, 1, 1,  4,    4,  4,  5,  6,  6,    8, 11, 14, 14 ]      # TE
]
# 1 2  3  4      5   6  7   8   9    10   11 12  13



own_projection = [
[2, 6, 6,  9,   10,  11, 12, 16, 16, 20, 21,  21, 21 ],  # QB
[1, 8, 10, 12,  14,  19, 20, 21, 22, 25, 26,  28, 31 ],  # RB
[1, 3, 4,  9,   9,  16, 16,  23, 26, 28, 28,  35, 36 ],    # WR
[1, 1, 1,  4,    4,  4,  5,  6,  6,  9,  10,  13, 13 ]      # TE
]
# 1 2  3  4      5   6  7   8   9    10   11 12  13

# desice wich input projection to use for the draft
rund_valg = own_projection

# extracts point at positions
point = [
    [QB[rund_valg[1][1]], QB[rund_valg[1][2]], QB[rund_valg[1][3]], QB[rund_valg[1][4]], QB[rund_valg[1][5]], QB[rund_valg[1][6]], QB[rund_valg[1][7]], QB[rund_valg[1][8]], QB[rund_valg[1][9]], QB[rund_valg[1][10]], QB[rund_valg[1][11]], QB[rund_valg[1][12]],  QB[rund_valg[1][13]] ],
    [RB[rund_valg[2][1]], RB[rund_valg[2][2]], RB[rund_valg[2][3]], RB[rund_valg[2][4]], RB[rund_valg[2][5]], RB[rund_valg[2][6]], RB[rund_valg[2][7]], RB[rund_valg[2][8]], RB[rund_valg[2][9]], RB[rund_valg[2][10]], RB[rund_valg[2][11]], RB[rund_valg[2][12]], RB[rund_valg[2][13]]],
    [WR[rund_valg[3][1]], WR[rund_valg[3][2]], WR[rund_valg[3][3]], WR[rund_valg[3][4]], WR[rund_valg[3][5]], WR[rund_valg[3][6]], WR[rund_valg[3][7]], WR[rund_valg[3][8]], WR[rund_valg[3][9]], WR[rund_valg[3][10]], WR[rund_valg[3][11]], WR[rund_valg[3][12]], WR[rund_valg[3][13]]],
    [TE[rund_valg[4][1]], TE[rund_valg[4][2]], TE[rund_valg[4][3]], TE[rund_valg[4][4]], TE[rund_valg[4][5]], TE[rund_valg[4][6]], TE[rund_valg[4][7]], TE[rund_valg[4][8]], TE[rund_valg[4][9]], TE[rund_valg[4][10]], TE[rund_valg[4][11]], TE[rund_valg[4][12]], TE[rund_valg[4][13]]],
]

# 2   15   18   31   35   48   51   64   68   82   86
# 1    2   3    4    5    6     7   8    9    10   11


# no of games played by drafted player
NoGames = 17 # total # of games

# total number of games played per posution
QB_games = 14.9
RB_games = 13.2
WR_games = 14
TE_games = 14.2

# total number of games played per position in given round
injury = [
[QB_games, QB_games, QB_games, QB_games, QB_games, QB_games, QB_games,  QB_games, QB_games, QB_games, QB_games, QB_games, QB_games],     # QB_games -> 1.5 missed games
[RB_games, RB_games, RB_games, RB_games, RB_games, RB_games, RB_games,  RB_games, RB_games, RB_games, RB_games, RB_games, RB_games],     # 14.2 -> 2.8 missed games
[WR_games,  WR_games,  WR_games,  WR_games,  WR_games,  WR_games,  WR_games,   WR_games,  WR_games,  WR_games,  WR_games,   WR_games,  WR_games],                 #16  -> 2 missed games
[TE_games,  TE_games,  TE_games,  TE_games,  TE_games,  TE_games,  TE_games,   TE_games,  TE_games,  TE_games,  TE_games,  TE_games,  TE_games]]                 #16  -> 2 missed games

# Point per game for replacemnet payer per position
repVal_rest = [14, 7.7, 7, 4.5] # if no drafted replacemnet, this is the amount of point gotten per game

no_replace = 1 # games where player is not replaced per drafted player
###### model ######

draft = Model(Cbc.Optimizer)

@variable(draft, Pick[1:P,1:R], Bin) #Choose player a each round_2 1 if chose
@variable(draft, Pick_bench[1:P,1:R], Bin) #Choose player a each round_2 1 if chose
@variable(draft, repVal[1:P, 1:R] >= 0) # point per game for replacemnet of per position

@objective(draft, Max, sum(Pick[p,r]*(point[p][r]*injury[p][r]/16+no_replace*repVal_rest[p]) +(NoGames-injury[p][r]-no_replace)*repVal[p,r]  for p=1:P, r=1:R) )

# states hthat we want to draft excatly the starters for each position
@constraint(draft, sum(Pick[1,r] for r=1:R) == position_target[1] )
@constraint(draft, sum(Pick[2,r] for r=1:R) >= position_target[2]  )
@constraint(draft, sum(Pick[3,r] for r=1:R) >= position_target[3]  )
@constraint(draft, sum(Pick[p,r] for r=1:R, p=2:3) <= position_target[5]  )
@constraint(draft, sum(Pick[4,r] for r=1:R) == position_target[4]  )


@constraint(draft, [r=1:R, p=1:P], repVal[p,r] <= repVal_rest[p]*Pick[p,r]*1000)
@constraint(draft, [r=1:R, p=1:P], repVal[p,r] <= sum(Pick_bench[p,r_2]*(point[p][r_2]/16*((injury[p][r_2])/16)+repVal_rest[p]*(1-injury[p][r_2]/16)    )  for r_2 =1:R) + (1-sum(Pick_bench[p,r_2] for r_2=1:R ) )*repVal_rest[p] )    # assumes that points is for full season (of 17 games)


@constraint(draft, Pick[1,1] == 1 )
@constraint(draft, Pick[2,2] == 1 )
@constraint(draft, Pick[2,3] == 1 )
@constraint(draft, Pick[2,4] == 1 )
@constraint(draft, Pick[4,5] == 1 )
@constraint(draft, Pick[2,6] == 1 )
@constraint(draft, Pick[3,7] == 1 )

# only draft one per round
@constraint(draft, [r=1:R], sum(Pick[p,r] + Pick_bench[p,r] for p=1:P) == 1 )

# only draft one extra/bench player per position
@constraint(draft, [p=1:P], sum(Pick_bench[p,r] for r=1:R) <= 1 )

optimize!(draft)
total_points = objective_value(draft)

println()
print("Der scores total antal point: ")
println(round(total_points))

for r=1:R
    print("I runde $r vælges")
    if value(Pick[1,r])>=0.9
        print(" en QB: ")
        println( QB[rund_valg[1][r],2] )
    elseif value(Pick[2,r])>=0.9
        print(" en RB: ")
        println( RB[rund_valg[2][r],2] )
    elseif value(Pick[3,r])>=0.9
        print(" en WR ")
        println( WR[rund_valg[3][r],2] )
    elseif value(Pick[4,r])>=0.9
        print(" en TE: ")
        println( TE[rund_valg[4][r],2] )
    elseif value(Pick_bench[1,r])>=0.9
        print(" en QB for bænken: ")
        println( QB[rund_valg[1][r],2] )
    elseif value(Pick_bench[2,r])>=0.9
        print(" en RB for bænken: ")
        println( RB[rund_valg[2][r],2] )
    elseif value(Pick_bench[3,r])>=0.9
        print(" en WR for bænken: ")
        println( WR[rund_valg[3][r],2] )
    elseif value(Pick_bench[4,r])>=0.9
        print(" en TE for bænken: ")
        println( TE[rund_valg[4][r],2] )
    end
end
